import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Package, AlertTriangle, ShoppingCart, RefreshCw, ArrowUpRight, 
  TrendingUp, TrendingDown, Layers, Building2, CheckCircle2, ArrowRight, 
  FolderTree, Clock, FileText, ShoppingBag, Plus, Sparkles, AlertCircle, 
  ArrowDownRight, Calendar, Printer, Download, Loader2, Building
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend } from 'recharts';
import * as XLSX from 'xlsx';
import api from '../../lib/axios';
import { getMediaUrl } from '../../lib/media';

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

export const computeInventoryDateRange = (preset) => {
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

export default function InventoryDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filter States
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [datePreset, setDatePreset] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingDoc, setIsExportingDoc] = useState(false);
  const [orderTab, setOrderTab] = useState('ALL'); // 'ALL', 'COMPLETED', 'PENDING'

  useEffect(() => {
    fetchDashboardData(false, startDate, endDate, selectedWarehouseId);
  }, [startDate, endDate, selectedWarehouseId]);

  const fetchDashboardData = async (isManualRefresh = false, sDate = startDate, eDate = endDate, whId = selectedWarehouseId) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const params = {};
      if (whId) params.warehouseId = whId;
      if (sDate) params.startDate = sDate;
      if (eDate) params.endDate = eDate;

      const res = await api.get('/inventory/dashboard/summary', { params });
      setData(res.data);
    } catch (e) {
      console.error('Failed to fetch inventory dashboard:', e);
      setError(e.response?.data?.error || e.message || 'Gagal memuat data dashboard logistik');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handlePresetChange = (preset) => {
    setDatePreset(preset);
    if (preset === 'ALL') {
      setShowCustomRange(false);
      setStartDate('');
      setEndDate('');
      setCustomStart('');
      setCustomEnd('');
    } else if (preset === 'CUSTOM') {
      setShowCustomRange(true);
    } else {
      setShowCustomRange(false);
      const r = computeInventoryDateRange(preset);
      setStartDate(r.startDate);
      setEndDate(r.endDate);
      setCustomStart(r.startDate);
      setCustomEnd(r.endDate);
    }
  };

  const handleApplyCustomDate = () => {
    setStartDate(customStart);
    setEndDate(customEnd);
  };

  const handleExportPDF = async () => {
    if (!data) return;
    setIsExportingPdf(true);
    try {
      const jsPDF = await loadJsPDF();
      const doc = new jsPDF('portrait', 'mm', 'a4');
      const pageW = doc.internal.pageSize.getWidth();
      const now = new Date();

      let periodLabel = 'Semua Riwayat Data';
      if (startDate && endDate) {
        const sStr = new Date(startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        const eStr = new Date(endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        periodLabel = `${sStr} s/d ${eStr}`;
        if (datePreset === 'LAST_7_DAYS' || datePreset === 'THIS_WEEK') {
          periodLabel += ' (Mingguan)';
        }
      } else if (startDate) {
        periodLabel = `Mulai ${new Date(startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      }

      const whName = selectedWarehouseId 
        ? (warehouses.find(w => String(w.id) === String(selectedWarehouseId))?.name || 'Gudang Terpilih')
        : 'Semua Gudang';

      const printDateStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

      // 1. KOP SURAT
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('YAYASAN DAR EL IMAN', pageW / 2, 13, { align: 'center' });

      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(30, 58, 138);
      doc.text('BIDANG SARANA', pageW / 2, 18, { align: 'center' });

      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(37, 99, 235);
      doc.text('LAPORAN MINGGUAN & PERIODIK MANAJEMEN GUDANG & LOGISTIK', pageW / 2, 23, { align: 'center' });

      doc.setFontSize(8.5);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`Periode: ${periodLabel}   |   Gudang: ${whName}   |   Dicetak: ${printDateStr}`, pageW / 2, 29, { align: 'center' });

      // Separator Line
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.6);
      doc.line(14, 32, pageW - 14, 32);

      let startY = 37;

      // 2. RINGKASAN EKSEKUTIF / KPI
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('1. Ringkasan Posisi & Mutasi Stok Gudang', 14, startY);
      startY += 4;

      doc.autoTable({
        startY,
        head: [['Total Nilai Aset', 'Total Stok Fisik', 'Barang Masuk (IN)', 'Barang Keluar (OUT)', 'Mutasi Antar Gudang', 'Pesanan Unit']],
        body: [[
          `Rp ${(metrics.totalAssetValue || 0).toLocaleString('id-ID')}`,
          `${(metrics.totalStockVolume || 0).toLocaleString('id-ID')} Unit`,
          `${periodMetrics.inQty || 0} Unit (${periodMetrics.inCount || 0}x)`,
          `${periodMetrics.outQty || 0} Unit (${periodMetrics.outCount || 0}x)`,
          `${periodMetrics.mutationQty || 0} Unit (${periodMetrics.mutationCount || 0}x)`,
          `${periodMetrics.totalOrders || 0} Pesanan`
        ]],
        theme: 'grid',
        headStyles: { fillColor: [37, 99, 235], fontSize: 8, fontStyle: 'bold', halign: 'center' },
        bodyStyles: { fontSize: 8, fontStyle: 'bold', halign: 'center', textColor: [30, 41, 59] },
        margin: { left: 14, right: 14 }
      });

      startY = doc.lastAutoTable.finalY + 8;

      // =========================================================================
      // 2. LAPORAN TOTAL PESANAN RENTANG TANGGAL YANG DIPILIH
      // =========================================================================
      const allPeriodOrders = data?.allPeriodOrders || [];
      const completedPeriodOrders = data?.completedPeriodOrders || allPeriodOrders.filter(o => o.status === 'COMPLETED');

      if (startY > doc.internal.pageSize.getHeight() - 75) {
        doc.addPage();
        startY = 20;
      }

      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(`2. Rekapitulasi & Daftar Total Pesanan Masuk Periode Terpilih (Total: ${allPeriodOrders.length} Pesanan)`, 14, startY);
      startY += 4;

      const pendingCount = periodMetrics.pendingOrders || allPeriodOrders.filter(o => o.status === 'PENDING').length;
      const approvedCount = periodMetrics.approvedOrders || allPeriodOrders.filter(o => o.status === 'APPROVED').length;
      const processCount = periodMetrics.processOrders || allPeriodOrders.filter(o => o.status === 'PROCESS').length;
      const completedCount = completedPeriodOrders.length;
      const rejectedCount = periodMetrics.rejectedOrders || allPeriodOrders.filter(o => o.status === 'REJECTED').length;

      // Status breakdown table
      doc.autoTable({
        startY,
        head: [['Total Pesanan Masuk', 'Menunggu Persetujuan', 'Disetujui', 'Dalam Proses', 'Selesai Disalurkan', 'Ditolak']],
        body: [[
          `${allPeriodOrders.length} Pesanan`,
          `${pendingCount}`,
          `${approvedCount}`,
          `${processCount}`,
          `${completedCount}`,
          `${rejectedCount}`
        ]],
        theme: 'grid',
        headStyles: { fillColor: [30, 64, 175], fontSize: 7.5, fontStyle: 'bold', halign: 'center' },
        bodyStyles: { fontSize: 7.5, fontStyle: 'bold', halign: 'center', textColor: [30, 41, 59] },
        margin: { left: 14, right: 14 }
      });

      startY = doc.lastAutoTable.finalY + 4;

      // Tabel Seluruh Pesanan Masuk
      const allOrderRows = allPeriodOrders.map((ord, i) => [
        i + 1,
        ord.code || '-',
        new Date(ord.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
        `${ord.requesterName || '-'}\n(${ord.requesterUnit || ord.createdBy?.unitId || '-'})`,
        ord.itemsSummary || (ord.items || []).map(it => `${it.item?.name} (${it.qtyRequested})`).join(', ') || '-',
        `${ord.totalQtyRequested || 0} Unit`,
        ord.status === 'COMPLETED' ? 'SELESAI' :
        ord.status === 'PROCESS' ? 'DIPROSES' :
        ord.status === 'APPROVED' ? 'DISETUJUI' :
        ord.status === 'REJECTED' ? 'DITOLAK' : 'MENUNGGU',
        ord.paymentStatus || 'BEBAS BIAYA'
      ]);

      doc.autoTable({
        startY,
        head: [['#', 'No. Pesanan', 'Tanggal', 'Pemohon & Unit Kerja', 'Rincian Barang Dipesan', 'Total Qty', 'Status Pesanan', 'Keterangan']],
        body: allOrderRows.length > 0 ? allOrderRows : [['-', 'Tidak ada pesanan masuk pada rentang tanggal yang dipilih', '-', '-', '-', '-', '-', '-']],
        foot: allOrderRows.length > 0 ? [[
          '', 'TOTAL PESANAN PERIODE INI', '', '', '',
          `${allPeriodOrders.reduce((sum, o) => sum + (o.totalQtyRequested || 0), 0)} Unit`,
          `${allPeriodOrders.length} Pesanan`, '-'
        ]] : undefined,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], fontSize: 7, fontStyle: 'bold' },
        footStyles: { fillColor: [239, 246, 255], textColor: [30, 64, 175], fontSize: 7, fontStyle: 'bold' },
        bodyStyles: { fontSize: 6.8 },
        margin: { left: 14, right: 14 }
      });

      startY = doc.lastAutoTable.finalY + 8;

      // =========================================================================
      // 3. LAPORAN PESANAN YANG SELESAI BERDASARKAN RENTANG TANGGAL YANG DIPILIH
      // =========================================================================
      if (startY > doc.internal.pageSize.getHeight() - 75) {
        doc.addPage();
        startY = 20;
      }

      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(`3. Daftar Pesanan yang Selesai Disalurkan (COMPLETED) (Total: ${completedPeriodOrders.length} Pesanan)`, 14, startY);
      startY += 4;

      const completedOrderRows = completedPeriodOrders.map((ord, i) => [
        i + 1,
        ord.code || '-',
        new Date(ord.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
        `${ord.requesterName || '-'}\n(${ord.requesterUnit || ord.createdBy?.unitId || '-'})`,
        ord.itemsSummary || (ord.items || []).map(it => `${it.item?.name} (${it.qtyDelivered || it.qtyRequested})`).join(', ') || '-',
        `${ord.totalQtyDelivered || ord.totalQtyRequested || 0} Unit`,
        ord.receiverName || ord.signatures?.requester?.name || ord.requesterName || '-',
        'Barang Telah Diserahkan'
      ]);

      doc.autoTable({
        startY,
        head: [['#', 'No. Pesanan', 'Tgl Pesan', 'Pemohon & Unit Kerja', 'Barang yang Diserahkan (Qty)', 'Total Qty', 'Penerima Barang', 'Status Penyaluran']],
        body: completedOrderRows.length > 0 ? completedOrderRows : [['-', 'Tidak ada pesanan yang selesai pada rentang tanggal ini', '-', '-', '-', '-', '-', '-']],
        foot: completedOrderRows.length > 0 ? [[
          '', 'TOTAL PESANAN SELESAI DISALURKAN', '', '', '',
          `${completedPeriodOrders.reduce((sum, o) => sum + (o.totalQtyDelivered || o.totalQtyRequested || 0), 0)} Unit`,
          `${completedPeriodOrders.length} Pesanan`, 'SELESAI'
        ]] : undefined,
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129], fontSize: 7, fontStyle: 'bold' },
        footStyles: { fillColor: [236, 253, 245], textColor: [6, 95, 70], fontSize: 7, fontStyle: 'bold' },
        bodyStyles: { fontSize: 6.8 },
        margin: { left: 14, right: 14 }
      });

      startY = doc.lastAutoTable.finalY + 8;

      // 4. BARANG PALING BANYAK KELUAR (FAST MOVING)
      if (periodMetrics.topOutItems && periodMetrics.topOutItems.length > 0) {
        if (startY > doc.internal.pageSize.getHeight() - 65) {
          doc.addPage();
          startY = 20;
        }

        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('4. Rekapitulasi Barang Paling Banyak Keluar / Dipakai (Periode Ini)', 14, startY);
        startY += 4;

        const headTop = [['#', 'Kode', 'Nama Barang', 'Kategori', 'Qty Keluar', 'Satuan']];
        const bodyTop = periodMetrics.topOutItems.map((item, i) => [
          i + 1,
          item.code || '-',
          item.name || '-',
          item.category || '-',
          item.qty || 0,
          item.unit || 'Pcs'
        ]);

        doc.autoTable({
          startY,
          head: headTop,
          body: bodyTop,
          theme: 'striped',
          headStyles: { fillColor: [249, 115, 22], fontSize: 7.5, fontStyle: 'bold' },
          bodyStyles: { fontSize: 7 },
          margin: { left: 14, right: 14 }
        });

        startY = doc.lastAutoTable.finalY + 8;
      }

      // 5. TABEL TRANSAKSI MUTASI DALAM PERIODE
      const transactionsToPrint = data?.allPeriodTransactions || recentTransactions;
      if (transactionsToPrint.length > 0) {
        if (startY > doc.internal.pageSize.getHeight() - 65) {
          doc.addPage();
          startY = 20;
        }

        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('5. Riwayat Transaksi & Mutasi Barang dalam Periode', 14, startY);
        startY += 4;

        const headTx = [['#', 'Tanggal', 'Kode TRX', 'Tipe', 'Nama Barang', 'Jumlah', 'Gudang', 'Petugas']];
        const bodyTx = transactionsToPrint.slice(0, 30).map((tx, i) => [
          i + 1,
          new Date(tx.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
          tx.code || '-',
          tx.type === 'IN' ? 'Masuk' : tx.type === 'OUT' ? 'Keluar' : tx.type === 'MUTATION' ? 'Mutasi' : tx.type,
          tx.item?.name || '-',
          `${Math.abs(tx.quantity || 0)} ${tx.item?.unit || 'Pcs'}`,
          tx.warehouse?.name || '-',
          tx.createdBy?.name || tx.createdBy?.username || '-'
        ]);

        doc.autoTable({
          startY,
          head: headTx,
          body: bodyTx,
          theme: 'striped',
          headStyles: { fillColor: [13, 148, 136], fontSize: 7.5, fontStyle: 'bold' },
          bodyStyles: { fontSize: 7 },
          margin: { left: 14, right: 14 }
        });

        startY = doc.lastAutoTable.finalY + 8;
      }

      // Page numbers
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7.5);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Halaman ${i} dari ${pageCount}  |  Laporan Logistik & Gudang Bidang Sarana`,
          pageW / 2,
          doc.internal.pageSize.getHeight() - 8,
          { align: 'center' }
        );
      }

      doc.save(`Laporan_Gudang_${startDate || 'All'}_sd_${endDate || 'All'}_${now.toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error(err);
      alert('Gagal mengekspor PDF laporan gudang: ' + err.message);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportDOC = () => {
    if (!data) return;
    setIsExportingDoc(true);
    try {
      const now = new Date();
      let periodLabel = 'Semua Riwayat Data';
      if (startDate && endDate) {
        const sStr = new Date(startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        const eStr = new Date(endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        periodLabel = `${sStr} s/d ${eStr}`;
        if (datePreset === 'LAST_7_DAYS' || datePreset === 'THIS_WEEK') {
          periodLabel += ' (Mingguan)';
        }
      } else if (startDate) {
        periodLabel = `Mulai ${new Date(startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      }

      const whName = selectedWarehouseId 
        ? (warehouses.find(w => String(w.id) === String(selectedWarehouseId))?.name || 'Gudang Terpilih')
        : 'Semua Gudang';

      const printDateStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      const fileCleanStart = (startDate || '').replace(/[^0-9]/g, '');
      const fileCleanEnd = (endDate || '').replace(/[^0-9]/g, '');

      // 1. KPI Table
      const table1Html = `
        <h4 style="margin: 12px 0 6px 0; font-size: 11pt; color: #1e293b; font-family: Calibri, Arial, sans-serif;">1. Ringkasan Posisi & Mutasi Stok Gudang</h4>
        <table class="report-table">
          <thead>
            <tr style="background-color: #2563eb; color: #ffffff;">
              <th>Total Nilai Aset</th>
              <th>Total Stok Fisik</th>
              <th>Barang Masuk (IN)</th>
              <th>Barang Keluar (OUT)</th>
              <th>Mutasi Antar Gudang</th>
              <th>Pesanan Unit</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="text-center font-bold">Rp ${(metrics.totalAssetValue || 0).toLocaleString('id-ID')}</td>
              <td class="text-center font-bold">${(metrics.totalStockVolume || 0).toLocaleString('id-ID')} Unit</td>
              <td class="text-center font-bold">${periodMetrics.inQty || 0} Unit (${periodMetrics.inCount || 0}x)</td>
              <td class="text-center font-bold">${periodMetrics.outQty || 0} Unit (${periodMetrics.outCount || 0}x)</td>
              <td class="text-center font-bold">${periodMetrics.mutationQty || 0} Unit (${periodMetrics.mutationCount || 0}x)</td>
              <td class="text-center font-bold">${periodMetrics.totalOrders || 0} Pesanan</td>
            </tr>
          </tbody>
        </table>
      `;

      // 2. Orders Summary & Table
      const pendingCount = periodMetrics.pendingOrders || allPeriodOrders.filter(o => o.status === 'PENDING').length;
      const approvedCount = periodMetrics.approvedOrders || allPeriodOrders.filter(o => o.status === 'APPROVED').length;
      const processCount = periodMetrics.processOrders || allPeriodOrders.filter(o => o.status === 'PROCESS').length;
      const completedCount = completedPeriodOrders.length;
      const rejectedCount = periodMetrics.rejectedOrders || allPeriodOrders.filter(o => o.status === 'REJECTED').length;

      const table2AHtml = `
        <h4 style="margin: 16px 0 6px 0; font-size: 11pt; color: #1e293b; font-family: Calibri, Arial, sans-serif;">2. Rekapitulasi & Daftar Total Pesanan Masuk (Total: ${allPeriodOrders.length} Pesanan)</h4>
        <table class="report-table">
          <thead>
            <tr style="background-color: #1e40af; color: #ffffff;">
              <th>Total Masuk</th>
              <th>Menunggu Persetujuan</th>
              <th>Disetujui</th>
              <th>Dalam Proses</th>
              <th>Selesai Disalurkan</th>
              <th>Ditolak</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="text-center font-bold">${allPeriodOrders.length} Pesanan</td>
              <td class="text-center font-bold">${pendingCount}</td>
              <td class="text-center font-bold">${approvedCount}</td>
              <td class="text-center font-bold">${processCount}</td>
              <td class="text-center font-bold">${completedCount}</td>
              <td class="text-center font-bold">${rejectedCount}</td>
            </tr>
          </tbody>
        </table>
      `;

      const allOrderRows = allPeriodOrders.map((ord, i) => `
        <tr>
          <td class="text-center">${i + 1}</td>
          <td class="text-center font-bold">${ord.code || '-'}</td>
          <td class="text-center">${new Date(ord.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
          <td><b>${ord.requesterName || '-'}</b><br/><small style="color: #64748b;">${ord.requesterUnit || ord.createdBy?.unitId || '-'}</small></td>
          <td>${ord.itemsSummary || (ord.items || []).map(it => `${it.item?.name} (${it.qtyRequested})`).join(', ') || '-'}</td>
          <td class="text-center font-bold">${ord.totalQtyRequested || 0} Unit</td>
          <td class="text-center font-bold">${ord.status === 'COMPLETED' ? 'SELESAI' : ord.status === 'PROCESS' ? 'DIPROSES' : ord.status === 'APPROVED' ? 'DISETUJUI' : ord.status === 'REJECTED' ? 'DITOLAK' : 'MENUNGGU'}</td>
          <td class="text-center">${ord.paymentStatus || 'BEBAS BIAYA'}</td>
        </tr>
      `).join('');

      const table2BHtml = `
        <h5 style="margin: 10px 0 4px 0; font-size: 9.5pt; color: #1e40af; font-family: Calibri, Arial, sans-serif;">Rincian Seluruh Pesanan Masuk:</h5>
        <table class="report-table">
          <thead>
            <tr style="background-color: #3b82f6; color: #ffffff;">
              <th style="width: 30px;">#</th>
              <th style="width: 95px;">No. Pesanan</th>
              <th style="width: 75px;">Tanggal</th>
              <th>Pemohon & Unit Kerja</th>
              <th>Rincian Barang Dipesan</th>
              <th style="width: 70px;">Total Qty</th>
              <th style="width: 85px;">Status</th>
              <th style="width: 85px;">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            ${allOrderRows || '<tr><td colspan="8" class="text-center">Tidak ada pesanan masuk pada rentang tanggal yang dipilih</td></tr>'}
          </tbody>
        </table>
      `;

      // 3. Completed Orders Table
      const completedOrderRows = completedPeriodOrders.map((ord, i) => `
        <tr>
          <td class="text-center">${i + 1}</td>
          <td class="text-center font-bold">${ord.code || '-'}</td>
          <td class="text-center">${new Date(ord.updatedAt || ord.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
          <td><b>${ord.requesterName || '-'}</b> (${ord.requesterUnit || ord.createdBy?.unitId || '-'})</td>
          <td>${(ord.items || []).map(it => `${it.item?.name} (${it.qtyFulfilled || it.qtyRequested} ${it.item?.unit || 'Pcs'})`).join(', ') || '-'}</td>
          <td class="text-center font-bold">${ord.totalQtyRequested || 0} Unit</td>
          <td class="text-center" style="color: #166534; font-weight: bold;">SELESAI DISALURKAN</td>
        </tr>
      `).join('');

      const table3Html = completedPeriodOrders.length > 0 ? `
        <h4 style="margin: 16px 0 6px 0; font-size: 11pt; color: #1e293b; font-family: Calibri, Arial, sans-serif;">3. Daftar Pesanan yang Selesai Disalurkan (COMPLETED) (Total: ${completedPeriodOrders.length} Pesanan)</h4>
        <table class="report-table">
          <thead>
            <tr style="background-color: #059669; color: #ffffff;">
              <th style="width: 30px;">#</th>
              <th style="width: 95px;">No. Pesanan</th>
              <th style="width: 80px;">Tgl Selesai</th>
              <th>Unit Penerima</th>
              <th>Rincian Barang Diserahkan</th>
              <th style="width: 70px;">Total Qty</th>
              <th style="width: 100px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${completedOrderRows}
          </tbody>
        </table>
      ` : '';

      // 4. Top Out Items
      const topOutRows = (periodMetrics.topOutItems || []).map((item, i) => `
        <tr>
          <td class="text-center">${i + 1}</td>
          <td class="text-center">${item.code || '-'}</td>
          <td><b>${item.name || '-'}</b></td>
          <td class="text-center">${item.category || '-'}</td>
          <td class="text-center font-bold">${item.qty || 0}</td>
          <td class="text-center">${item.unit || 'Pcs'}</td>
        </tr>
      `).join('');

      const table4Html = (periodMetrics.topOutItems || []).length > 0 ? `
        <h4 style="margin: 16px 0 6px 0; font-size: 11pt; color: #1e293b; font-family: Calibri, Arial, sans-serif;">4. Rekapitulasi Barang Paling Banyak Keluar / Dipakai</h4>
        <table class="report-table">
          <thead>
            <tr style="background-color: #ea580c; color: #ffffff;">
              <th style="width: 30px;">#</th>
              <th style="width: 80px;">Kode</th>
              <th>Nama Barang</th>
              <th style="width: 100px;">Kategori</th>
              <th style="width: 80px;">Qty Keluar</th>
              <th style="width: 60px;">Satuan</th>
            </tr>
          </thead>
          <tbody>
            ${topOutRows}
          </tbody>
        </table>
      ` : '';

      // 5. Recent Transactions
      const transactionsToPrint = data?.allPeriodTransactions || recentTransactions;
      const txRows = (transactionsToPrint || []).slice(0, 30).map((tx, i) => `
        <tr>
          <td class="text-center">${i + 1}</td>
          <td class="text-center">${new Date(tx.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
          <td class="text-center font-bold">${tx.code || '-'}</td>
          <td class="text-center font-bold">${tx.type === 'IN' ? 'Masuk' : tx.type === 'OUT' ? 'Keluar' : tx.type === 'MUTATION' ? 'Mutasi' : tx.type}</td>
          <td><b>${tx.item?.name || '-'}</b></td>
          <td class="text-center font-bold">${Math.abs(tx.quantity || 0)} ${tx.item?.unit || 'Pcs'}</td>
          <td>${tx.warehouse?.name || '-'}</td>
          <td>${tx.createdBy?.name || tx.createdBy?.username || '-'}</td>
        </tr>
      `).join('');

      const table5Html = (transactionsToPrint || []).length > 0 ? `
        <h4 style="margin: 16px 0 6px 0; font-size: 11pt; color: #1e293b; font-family: Calibri, Arial, sans-serif;">5. Riwayat Transaksi & Mutasi Barang dalam Periode</h4>
        <table class="report-table">
          <thead>
            <tr style="background-color: #0d9488; color: #ffffff;">
              <th style="width: 30px;">#</th>
              <th style="width: 80px;">Tanggal</th>
              <th style="width: 100px;">Kode TRX</th>
              <th style="width: 70px;">Tipe</th>
              <th>Nama Barang</th>
              <th style="width: 80px;">Jumlah</th>
              <th>Gudang</th>
              <th>Petugas</th>
            </tr>
          </thead>
          <tbody>
            ${txRows}
          </tbody>
        </table>
      ` : '';

      const docHtml = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office'
              xmlns:w='urn:schemas-microsoft-com:office:word'
              xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset="utf-8">
          <title>Laporan Manajemen Gudang & Logistik</title>
          <!--[if gte mso 9]>
          <xml>
            <w:WordDocument>
              <w:View>Print</w:View>
              <w:Zoom>100</w:Zoom>
              <w:DoNotOptimizeForBrowser/>
            </w:WordDocument>
          </xml>
          <![endif]-->
          <style>
            @page Section1 {
              size: 595.3pt 841.9pt;
              mso-page-orientation: portrait;
              margin: 1.5cm 1.5cm 1.5cm 1.5cm;
            }
            div.Section1 {
              page: Section1;
              font-family: 'Calibri', 'Arial', sans-serif;
              font-size: 9.5pt;
              color: #1e293b;
            }
            .report-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 12px;
              font-size: 8.5pt;
              font-family: Calibri, Arial, sans-serif;
            }
            .report-table th, .report-table td {
              border: 1px solid #cbd5e1;
              padding: 5px 7px;
              vertical-align: middle;
            }
            .report-table th {
              font-weight: bold;
              text-align: center;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="Section1">
            <!-- Kop Surat -->
            <div style="text-align: center; margin-bottom: 14px; border-bottom: 2px solid #cbd5e1; padding-bottom: 8px;">
              <h2 style="margin: 0; font-size: 14pt; color: #1e293b; font-family: Calibri, Arial, sans-serif; text-transform: uppercase;">YAYASAN DAR EL IMAN</h2>
              <h3 style="margin: 2px 0; font-size: 11pt; color: #1e3a8a; font-family: Calibri, Arial, sans-serif; text-transform: uppercase;">BIDANG SARANA</h3>
              <h4 style="margin: 4px 0 2px 0; font-size: 11pt; color: #2563eb; font-family: Calibri, Arial, sans-serif;">LAPORAN MINGGUAN & PERIODIK MANAJEMEN GUDANG & LOGISTIK (INVENTORY)</h4>
              <p style="margin: 2px 0 0 0; font-size: 8.5pt; color: #64748b; font-family: Calibri, Arial, sans-serif;">
                Periode: <b>${periodLabel}</b> &nbsp;|&nbsp; Gudang: <b>${whName}</b> &nbsp;|&nbsp; Dicetak: <b>${printDateStr}</b>
              </p>
            </div>

            ${table1Html}
            ${table2AHtml}
            ${table2BHtml}
            ${table3Html}
            ${table4Html}
            ${table5Html}

            <div style="margin-top: 25px; border-top: 1px solid #e2e8f0; padding-top: 6px; font-size: 8pt; color: #94a3b8; text-align: center;">
              Laporan Logistik & Pergudangan Bidang Sarana Yayasan Dar El Iman &nbsp;|&nbsp; Dicetak Otomatis oleh Sistem
            </div>
          </div>
        </body>
        </html>
      `;

      const blob = new Blob(['\ufeff', docHtml], {
        type: 'application/msword'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Laporan_Gudang_Logistik_${fileCleanStart || 'Semua'}_sd_${fileCleanEnd || 'Semua'}_${now.toISOString().slice(0, 10)}.doc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('DOC Export Error:', err);
      alert('Gagal mengekspor Word (.doc) laporan gudang: ' + err.message);
    } finally {
      setIsExportingDoc(false);
    }
  };

  const handleExportExcel = () => {
    const list = data?.allPeriodTransactions || recentTransactions || [];
    if (list.length === 0) {
      return alert('Tidak ada transaksi untuk diekspor pada periode ini.');
    }
    const rows = list.map((tx, idx) => ({
      'No': idx + 1,
      'Kode Transaksi': tx.code || '-',
      'Tanggal': new Date(tx.date).toLocaleDateString('id-ID'),
      'Tipe Mutasi': tx.type,
      'Kode Barang': tx.item?.code || '-',
      'Nama Barang': tx.item?.name || '-',
      'Kategori': tx.item?.category?.name || '-',
      'Kuantitas': Math.abs(tx.quantity || 0),
      'Satuan': tx.item?.unit || 'Pcs',
      'Gudang Sumber': tx.warehouse?.name || '-',
      'Gudang Tujuan': tx.toWarehouse?.name || '-',
      'Petugas': tx.createdBy?.name || tx.createdBy?.username || '-',
      'Catatan': tx.note || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mutasi Gudang');
    XLSX.writeFile(wb, `Laporan_Mutasi_Gudang_${startDate || 'All'}_sd_${endDate || 'All'}.xlsx`);
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="w-10 h-10 text-blue-600 animate-spin" />
        <p className="text-sm font-semibold text-slate-500">Memuat Dashboard Manajemen Gudang...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4 p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
          <AlertTriangle size={32} />
        </div>
        <div className="max-w-md">
          <h2 className="text-lg font-bold text-slate-800">Gagal Memuat Data Dashboard</h2>
          <p className="text-xs text-slate-500 mt-1">{error}</p>
        </div>
        <button
          onClick={() => fetchDashboardData()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 flex items-center gap-2"
        >
          <RefreshCw size={14} /> Coba Lagi
        </button>
      </div>
    );
  }

  const metrics = data?.metrics || {};
  const periodMetrics = data?.periodMetrics || {};
  const allPeriodOrders = data?.allPeriodOrders || [];
  const completedPeriodOrders = data?.completedPeriodOrders || allPeriodOrders.filter(o => o.status === 'COMPLETED');
  const warehouses = data?.warehouses || [];
  const alertItems = data?.alertItems || [];
  const recentPendingOrders = data?.recentPendingOrders || [];
  const recentTransactions = data?.recentTransactions || [];
  const categoryChartData = data?.categoryChartData || [];
  const orderStatusData = data?.orderStatusData || [];

  const displayedOrders = orderTab === 'COMPLETED' 
    ? completedPeriodOrders 
    : orderTab === 'PENDING'
    ? allPeriodOrders.filter(o => o.status !== 'COMPLETED' && o.status !== 'REJECTED')
    : allPeriodOrders;

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">
              Dashboard Logistik & Gudang
            </h1>
            <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-blue-200">
              Live Overview
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Ringkasan stok barang, mutasi mingguan / per tanggal, pengajuan unit, dan status gudang yayasan.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing}
            className="flex-1 sm:flex-none bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-slate-200 disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin text-blue-600' : ''} />
            {refreshing ? 'Memperbarui...' : 'Refresh Data'}
          </button>
          
          <Link
            to="/inventory/orders"
            className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5"
          >
            <ShoppingBag size={14} /> Buat Pesanan
          </Link>
        </div>
      </div>

      {/* FILTER PERIODE & REPORT CONTROL BAR */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
          
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {/* Filter Gudang */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700">
              <Building size={14} className="text-blue-600" />
              <span>Gudang:</span>
              <select
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                className="bg-transparent font-extrabold text-blue-700 outline-none cursor-pointer"
              >
                <option value="">Semua Lokasi Gudang ({warehouses.length})</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            {/* Filter Periode */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700">
              <Calendar size={14} className="text-indigo-600" />
              <span>Periode:</span>
              <select
                value={datePreset}
                onChange={(e) => handlePresetChange(e.target.value)}
                className="bg-transparent font-extrabold text-indigo-700 outline-none cursor-pointer"
              >
                <option value="ALL">⚡ Semua Riwayat Data</option>
                <option value="LAST_7_DAYS">📅 7 Hari Terakhir (Mingguan)</option>
                <option value="THIS_WEEK">📅 Minggu Ini</option>
                <option value="THIS_MONTH">📅 Bulan Ini</option>
                <option value="LAST_30_DAYS">📅 30 Hari Terakhir</option>
                <option value="CUSTOM">🗓️ Pilih Rentang Tanggal...</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
            <button
              onClick={handleExportPDF}
              disabled={isExportingPdf}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
              title="Cetak Laporan Mutasi Gudang Mingguan atau Per Tanggal"
            >
              {isExportingPdf ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
              <span>{isExportingPdf ? 'Menyusun PDF...' : 'Cetak Laporan PDF'}</span>
            </button>

            <button
              onClick={handleExportDOC}
              disabled={isExportingDoc}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm shadow-indigo-500/20 disabled:opacity-50 cursor-pointer"
              title="Unduh Laporan Versi Microsoft Word (.doc)"
            >
              {isExportingDoc ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
              <span>{isExportingDoc ? 'Menyusun Word...' : 'Cetak Laporan DOC'}</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm shadow-emerald-500/20"
              title="Unduh Data Mutasi ke File Excel"
            >
              <Download size={14} />
              <span>Ekspor Excel</span>
            </button>
          </div>
        </div>

        {/* Custom Date Range Picker */}
        {showCustomRange && (
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 bg-slate-50/50 p-2.5 rounded-xl">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Mulai:</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Sampai:</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-500"
              />
            </div>
            <button
              onClick={handleApplyCustomDate}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
            >
              Terapkan Tanggal
            </button>
            <button
              onClick={() => handlePresetChange('ALL')}
              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition"
            >
              Reset ke Semua
            </button>
          </div>
        )}

        {/* Active Filter Period Badge */}
        {(startDate || endDate) && (
          <div className="flex items-center justify-between text-xs bg-blue-50/70 border border-blue-200/80 rounded-xl px-3.5 py-2 text-blue-900">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-blue-600" />
              <span>
                <strong>Periode Aktif:</strong> {startDate ? new Date(startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Awal'} s/d {endDate ? new Date(endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Hari Ini'}
                {datePreset === 'LAST_7_DAYS' && ' (7 Hari Terakhir / Mingguan)'}
                {datePreset === 'THIS_WEEK' && ' (Minggu Ini)'}
                {datePreset === 'THIS_MONTH' && ' (Bulan Ini)'}
                {datePreset === 'LAST_30_DAYS' && ' (30 Hari Terakhir)'}
              </span>
            </div>
            <button
              onClick={() => handlePresetChange('ALL')}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 underline ml-3"
            >
              Reset Filter
            </button>
          </div>
        )}
      </div>

      {/* PERIOD MUTATION HIGHLIGHTS (Ketika Periode Aktif) */}
      {(startDate || endDate || periodMetrics.totalTransactions > 0) && (
        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-5 rounded-2xl shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
                <TrendingUp size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-wide">
                  Rekapitulasi Mutasi Gudang ({startDate ? new Date(startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : 'Awal'} - {endDate ? new Date(endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Kini'})
                </h3>
                <p className="text-[11px] text-slate-400">Total {periodMetrics.totalTransactions || 0} transaksi pergerakan barang dalam periode ini.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                <ArrowDownRight size={12} /> Barang Masuk (IN)
              </span>
              <div className="text-xl font-extrabold text-white mt-1">
                {periodMetrics.inQty || 0} <span className="text-xs font-normal text-slate-400">Unit</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">{periodMetrics.inCount || 0} Kali Masuk</div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1">
                <ArrowUpRight size={12} /> Barang Keluar (OUT)
              </span>
              <div className="text-xl font-extrabold text-white mt-1">
                {periodMetrics.outQty || 0} <span className="text-xs font-normal text-slate-400">Unit</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">{periodMetrics.outCount || 0} Kali Keluar</div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                <ArrowRight size={12} /> Mutasi Antar Gudang
              </span>
              <div className="text-xl font-extrabold text-white mt-1">
                {periodMetrics.mutationQty || 0} <span className="text-xs font-normal text-slate-400">Unit</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">{periodMetrics.mutationCount || 0} Mutasi</div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                <ShoppingCart size={12} /> Pengajuan Requisition
              </span>
              <div className="text-xl font-extrabold text-white mt-1">
                {periodMetrics.totalOrders || 0} <span className="text-xs font-normal text-slate-400">Pesanan</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">{periodMetrics.completedOrders || 0} Selesai Disalurkan</div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION: LAPORAN PESANAN PERIODE TERPILIH (TOTAL PESANAN & PESANAN SELESAI) */}
      {(startDate || endDate || allPeriodOrders.length > 0) && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-3">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                <ShoppingCart size={16} />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                  Laporan Pesanan Periode Terpilih ({startDate ? `${new Date(startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} s/d ${new Date(endDate || startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Semua Periode'})
                </h3>
                <p className="text-[10px] text-slate-500">
                  Total {allPeriodOrders.length} Pesanan Masuk • {completedPeriodOrders.length} Pesanan Telah Selesai Disalurkan
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="inline-flex bg-slate-200/80 p-0.5 rounded-lg text-xs font-bold">
                <button
                  onClick={() => setOrderTab('ALL')}
                  className={`px-3 py-1 rounded-md transition-all ${orderTab === 'ALL' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Semua Pesanan ({allPeriodOrders.length})
                </button>
                <button
                  onClick={() => setOrderTab('COMPLETED')}
                  className={`px-3 py-1 rounded-md transition-all ${orderTab === 'COMPLETED' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Pesanan Selesai ({completedPeriodOrders.length})
                </button>
                <button
                  onClick={() => setOrderTab('PENDING')}
                  className={`px-3 py-1 rounded-md transition-all ${orderTab === 'PENDING' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Menunggu / Proses ({allPeriodOrders.filter(o => o.status !== 'COMPLETED' && o.status !== 'REJECTED').length})
                </button>
              </div>

              <button
                onClick={handleExportPDF}
                disabled={isExportingPdf}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shadow-xs"
              >
                {isExportingPdf ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />}
                <span>Cetak PDF</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 text-center w-12">#</th>
                  <th className="py-2.5 px-4">No. Pesanan</th>
                  <th className="py-2.5 px-4">Tanggal</th>
                  <th className="py-2.5 px-4">Pemohon & Unit</th>
                  <th className="py-2.5 px-4">Rincian Barang</th>
                  <th className="py-2.5 px-4 text-center">Total Qty</th>
                  <th className="py-2.5 px-4 text-center">Status Pesanan</th>
                  <th className="py-2.5 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {displayedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                      Tidak ada pesanan ditemukan untuk filter ini.
                    </td>
                  </tr>
                ) : (
                  displayedOrders.map((ord, idx) => (
                    <tr key={ord.id || idx} className="hover:bg-blue-50/20 transition-colors">
                      <td className="py-2.5 px-4 text-center text-slate-400 font-bold">{idx + 1}</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-800">{ord.code}</td>
                      <td className="py-2.5 px-4 text-slate-500 font-mono">
                        {new Date(ord.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="font-bold text-slate-900">{ord.requesterName}</div>
                        <div className="text-[10px] text-slate-500 font-semibold">{ord.requesterUnit || ord.createdBy?.unitId || '-'}</div>
                      </td>
                      <td className="py-2.5 px-4 text-slate-700 max-w-[280px] truncate" title={ord.itemsSummary || ord.itemNames}>
                        {ord.itemsSummary || ord.itemNames || '-'}
                      </td>
                      <td className="py-2.5 px-4 text-center font-bold text-slate-800">
                        {ord.totalQtyDelivered || ord.totalQtyRequested || 0} Unit
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        {ord.status === 'COMPLETED' ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                            Selesai
                          </span>
                        ) : ord.status === 'PROCESS' ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-indigo-100 text-indigo-800 uppercase tracking-wider">
                            Diproses
                          </span>
                        ) : ord.status === 'APPROVED' ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-blue-100 text-blue-800 uppercase tracking-wider">
                            Disetujui
                          </span>
                        ) : ord.status === 'REJECTED' ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-100 text-rose-800 uppercase tracking-wider">
                            Ditolak
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-100 text-amber-800 uppercase tracking-wider">
                            Menunggu
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <Link
                          to={`/inventory/orders?search=${ord.code}`}
                          className="text-blue-600 hover:text-blue-800 font-bold inline-flex items-center gap-1"
                        >
                          Detail <ArrowRight size={11} />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* QUICK ACTIONS BAR */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link 
          to="/inventory/master" 
          className="bg-white p-3.5 rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all flex items-center gap-3 group"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Package size={20} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800">Master Barang</div>
            <div className="text-[10px] text-slate-400">Kelola katalog barang</div>
          </div>
        </Link>

        <Link 
          to="/inventory/orders" 
          className="bg-white p-3.5 rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all flex items-center gap-3 group"
        >
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
            <ShoppingCart size={20} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800">Pesanan Requisition</div>
            <div className="text-[10px] text-slate-400">{metrics.pendingOrders || 0} Butuh Approval</div>
          </div>
        </Link>

        <Link 
          to="/inventory/transactions" 
          className="bg-white p-3.5 rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all flex items-center gap-3 group"
        >
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
            <TrendingUp size={20} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800">Mutasi Stok</div>
            <div className="text-[10px] text-slate-400">Barang masuk & keluar</div>
          </div>
        </Link>

        <Link 
          to="/inventory/stock" 
          className="bg-white p-3.5 rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all flex items-center gap-3 group"
        >
          <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Layers size={20} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800">Stok per Gudang</div>
            <div className="text-[10px] text-slate-400">{metrics.totalWarehouses || 0} Gudang aktif</div>
          </div>
        </Link>
      </div>

      {/* METRIC CARDS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Total Items */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Katalog Barang</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Package size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-800">{metrics.totalItems || 0} <span className="text-sm font-semibold text-slate-500">Jenis</span></div>
            <p className="text-xs font-semibold text-blue-600 mt-1">
              Rp {(metrics.totalAssetValue || 0).toLocaleString('id-ID')} <span className="text-[10px] text-slate-400 font-normal">(Nilai Aset)</span>
            </p>
          </div>
        </div>

        {/* Card 2: Total Volume Stock */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Unit Stok</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Layers size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-800">{(metrics.totalStockVolume || 0).toLocaleString('id-ID')} <span className="text-sm font-semibold text-slate-500">Item</span></div>
            <p className="text-xs text-slate-500 mt-1">
              Tersebar di <span className="font-bold text-slate-700">{metrics.totalWarehouses || 0} Gudang</span>
            </p>
          </div>
        </div>

        {/* Card 3: Alert Stock */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Peringatan Stok</span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-rose-600">
              {(metrics.lowStockCount || 0) + (metrics.outOfStockCount || 0)} <span className="text-sm font-semibold text-slate-500">Item Warning</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold mt-1">
              <span className="text-amber-600 font-bold">{metrics.lowStockCount || 0} Menipis</span>
              <span className="text-slate-300">•</span>
              <span className="text-rose-600 font-bold">{metrics.outOfStockCount || 0} Habis</span>
            </div>
          </div>
        </div>

        {/* Card 4: Pending Orders */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pesanan Menunggu</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <ShoppingCart size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-amber-600">{metrics.pendingOrders || 0} <span className="text-sm font-semibold text-slate-500">Pengajuan</span></div>
            <p className="text-xs text-slate-500 mt-1">
              Dari total <span className="font-bold text-slate-700">{metrics.totalOrders || 0} pesanan</span> terdaftar
            </p>
          </div>
        </div>
      </div>

      {/* CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Category Breakdown (Bar Chart) - 7 cols */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                <FolderTree size={16} className="text-blue-600" /> Komposisi Barang per Kategori
              </h2>
              <p className="text-xs text-slate-400">Jumlah varian barang di tiap kategori logistik.</p>
            </div>
            <span className="text-xs font-bold text-slate-500">{categoryChartData.length} Kategori</span>
          </div>

          <div className="h-64 w-full">
            {categoryChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">Belum ada data kategori.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} interval={0} angle={-15} textAnchor="end" />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }} 
                    itemStyle={{ color: '#60a5fa' }}
                  />
                  <Bar dataKey="totalItems" name="Jumlah Barang" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Order Status Breakdown (Pie Chart) - 5 cols */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                <ShoppingCart size={16} className="text-blue-600" /> Status Pesanan Unit
              </h2>
              <p className="text-xs text-slate-400">Proporsi status pesanan barang requisition.</p>
            </div>
          </div>

          <div className="h-64 w-full flex items-center justify-center relative">
            {orderStatusData.length === 0 ? (
              <div className="text-xs text-slate-400">Belum ada transaksi pesanan.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={orderStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {orderStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#fff', fontSize: '12px' }} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* OPERATIONAL WIDGETS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* STOCK ALERTS WIDGET - 6 Cols */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
                <AlertTriangle size={16} />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Perhatian Stok (Menipis / Habis)</h3>
                <p className="text-[10px] text-slate-400">Segera lakukan restock atau pengadaan ulang.</p>
              </div>
            </div>
            <Link to="/inventory/master" className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
              Lihat Semua <ArrowRight size={12} />
            </Link>
          </div>

          <div className="p-2 divide-y divide-slate-100 overflow-y-auto max-h-[340px]">
            {alertItems.length === 0 ? (
              <div className="p-8 text-center space-y-1">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="text-xs font-bold text-slate-700">Semua Stok Aman!</p>
                <p className="text-[10px] text-slate-400">Tidak ada barang dengan stok menipis atau habis.</p>
              </div>
            ) : (
              alertItems.map(item => (
                <div key={item.id} className="p-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors rounded-xl gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                      {item.image ? (
                        <img src={getMediaUrl(item.image)} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package size={18} className="text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-800 truncate" title={item.name}>{item.name}</h4>
                      <p className="text-[10px] text-slate-400 font-mono">{item.code} • Kategori: {item.categoryName}</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {item.isOut ? (
                      <span className="bg-rose-500 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full shadow-sm">
                        Habis (0 {item.unit})
                      </span>
                    ) : (
                      <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-extrabold px-2.5 py-1 rounded-full shadow-sm">
                        Sisa: {item.currentStock} {item.unit} (Min: {item.minStock})
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* PENDING REQUISITIONS WIDGET - 6 Cols */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                <Clock size={16} />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Pesanan Menunggu Persetujuan</h3>
                <p className="text-[10px] text-slate-400">Pengajuan barang terbaru dari unit yang butuh tindakan admin.</p>
              </div>
            </div>
            <Link to="/inventory/orders" className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
              Kelola Pesanan <ArrowRight size={12} />
            </Link>
          </div>

          <div className="p-2 divide-y divide-slate-100 overflow-y-auto max-h-[340px]">
            {recentPendingOrders.length === 0 ? (
              <div className="p-8 text-center space-y-1">
                <CheckCircle2 className="w-8 h-8 text-blue-500 mx-auto" />
                <p className="text-xs font-bold text-slate-700">Tidak Ada Antrean Pesanan!</p>
                <p className="text-[10px] text-slate-400">Semua pesanan requisition telah diproses.</p>
              </div>
            ) : (
              recentPendingOrders.map(order => (
                <div key={order.id} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors rounded-xl gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-700">{order.code}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(order.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-800 mt-0.5">{order.requesterName} <span className="text-[11px] font-normal text-slate-500">({order.requesterUnit || '-'})</span></p>
                    <p className="text-[10px] text-slate-400">{order.items?.length || 0} item barang diajukan</p>
                  </div>

                  <Link 
                    to="/inventory/orders"
                    className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 shrink-0"
                  >
                    Proses <ArrowRight size={12} />
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* RECENT TRANSACTIONS TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <TrendingUp size={16} />
            </div>
            <div>
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Aktivitas Mutasi Stok Terakhir</h3>
              <p className="text-[10px] text-slate-400">Riwayat barang masuk (IN) dan keluar (OUT) terbaru.</p>
            </div>
          </div>

          <Link to="/inventory/transactions" className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
            Lihat Semua Mutasi <ArrowRight size={12} />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/70 text-slate-500 text-[11px] font-extrabold uppercase tracking-wider border-b border-slate-200">
                <th className="p-3">Tanggal</th>
                <th className="p-3">Tipe Mutasi</th>
                <th className="p-3">Barang</th>
                <th className="p-3">Gudang</th>
                <th className="p-3 text-center">Jumlah</th>
                <th className="p-3">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {recentTransactions.length === 0 ? (
                <tr><td colSpan="6" className="p-6 text-center text-slate-400">Belum ada transaksi mutasi tercatat.</td></tr>
              ) : (
                recentTransactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-3 text-slate-500 font-mono">
                      {new Date(tx.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="p-3">
                      {tx.type === 'IN' ? (
                        <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-extrabold flex items-center w-fit gap-1">
                          <ArrowDownRight size={10} /> MASUK (IN)
                        </span>
                      ) : tx.type === 'OUT' ? (
                        <span className="bg-rose-100 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full text-[10px] font-extrabold flex items-center w-fit gap-1">
                          <ArrowUpRight size={10} /> KELUAR (OUT)
                        </span>
                      ) : (
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-[10px] font-extrabold">
                          {tx.type}
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-bold text-slate-800">{tx.item?.name || '-'}</td>
                    <td className="p-3 text-slate-600">{tx.warehouse?.name || '-'}</td>
                    <td className="p-3 text-center font-extrabold text-slate-800">
                      {tx.quantity} {tx.item?.unit || ''}
                    </td>
                    <td className="p-3 text-slate-500 italic truncate max-w-[200px]" title={tx.note}>{tx.note || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
