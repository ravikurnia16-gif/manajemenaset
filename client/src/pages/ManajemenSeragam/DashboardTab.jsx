import React, { useState, useMemo } from 'react';
import { 
  Shirt, Package, AlertCircle, ShoppingCart, TrendingUp, Clock, 
  Building, CheckCircle2, ArrowUpRight, ArrowDownRight, RefreshCw, 
  ExternalLink, Layers, ChevronRight, DollarSign, Sparkles, Filter,
  AlertTriangle, Search, Download, FileSpreadsheet, Check
} from 'lucide-react';
import { Badge } from './UIComponents';

export const DashboardTab = ({ 
  stats = {}, 
  warehouses = [], 
  selectedWarehouseId = '', 
  onSelectWarehouse, 
  onRefresh, 
  onNavigate 
}) => {
  const [activeTableTab, setActiveTableTab] = useState('urgent_restock'); // 'urgent_restock' | 'low_stock' | 'activity'
  const [restockFilter, setRestockFilter] = useState('ALL'); // 'ALL' | 'CRITICAL_URGENT' | 'OUT_OF_STOCK' | 'LOW_STOCK'
  const [restockSearch, setRestockSearch] = useState('');

  const {
    totalItems = 0,
    totalVariants = 0,
    totalStock = 0,
    totalAssetValue = 0,
    warehouseBreakdown = [],
    sales = {},
    fulfillment = {},
    topIndentItems = [],
    topSellingItems = [],
    lowStockCount = 0,
    lowStockItems = [],
    urgentRestockCount = 0,
    urgentRestockItems = [],
    recentActivity = []
  } = stats;

  const totalSalesCount = sales.total || 0;
  const totalRevenue = sales.totalRevenue || 0;
  const totalPaid = sales.totalPaid || 0;
  const totalUnpaid = sales.totalUnpaid || 0;
  const paidPercentage = totalRevenue > 0 ? Math.round((totalPaid / totalRevenue) * 100) : 0;

  const totalFulfillmentItems = (fulfillment.sedia || 0) + (fulfillment.diambil || 0) + (fulfillment.indent || 0);
  const deliveredPercentage = totalFulfillmentItems > 0 
    ? Math.round(((fulfillment.diambil || 0) / totalFulfillmentItems) * 100) 
    : 0;

  // Metric Aggregates for Urgent Restock
  const totalRecommendedQty = useMemo(() => 
    urgentRestockItems.reduce((sum, item) => sum + (item.recommendedQty || 0), 0)
  , [urgentRestockItems]);

  const totalIndentDemandQty = useMemo(() => 
    urgentRestockItems.reduce((sum, item) => sum + (item.totalIndentDemand || 0), 0)
  , [urgentRestockItems]);

  const criticalCount = useMemo(() => 
    urgentRestockItems.filter(i => i.urgency === 'CRITICAL' || i.urgency === 'URGENT').length
  , [urgentRestockItems]);

  const outOfStockCount = useMemo(() => 
    urgentRestockItems.filter(i => i.currentStock <= 0).length
  , [urgentRestockItems]);

  // Filtered Urgent Restock Items
  const filteredUrgentItems = useMemo(() => {
    let list = [...urgentRestockItems];
    if (restockFilter === 'CRITICAL_URGENT') {
      list = list.filter(i => i.urgency === 'CRITICAL' || i.urgency === 'URGENT');
    } else if (restockFilter === 'OUT_OF_STOCK') {
      list = list.filter(i => i.currentStock <= 0);
    } else if (restockFilter === 'LOW_STOCK') {
      list = list.filter(i => i.urgency === 'LOW_STOCK' && i.currentStock > 0);
    }

    if (restockSearch) {
      const q = restockSearch.toLowerCase();
      list = list.filter(i => 
        i.itemName?.toLowerCase().includes(q) ||
        i.unitName?.toLowerCase().includes(q) ||
        i.sizeName?.toLowerCase().includes(q) ||
        i.sku?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [urgentRestockItems, restockFilter, restockSearch]);

  const handleExportRestockCSV = () => {
    if (filteredUrgentItems.length === 0) return;
    let csv = "No,Nama Seragam,Jenjang/Unit,Kategori,Ukuran,Sisa Stok,Kebutuhan Inden,Batas Min,Rekomendasi Pesan (Qty PO),Urgensi,Sebaran Gudang\n";
    filteredUrgentItems.forEach((i, idx) => {
      csv += `"${idx + 1}","${i.itemName}","${i.unitName}","${i.categoryName}","${i.sizeName}","${i.currentStock}","${i.totalIndentDemand}","${i.minStock}","${i.recommendedQty}","${i.urgencyLabel}","${i.warehouseBreakdown}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Daftar_Pesan_Segera_Seragam_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* Top Filter & Quick Control Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700">
            <Building size={14} className="text-blue-600" />
            <span>Filter Gudang:</span>
            <select
              value={selectedWarehouseId}
              onChange={(e) => onSelectWarehouse && onSelectWarehouse(e.target.value)}
              className="bg-transparent font-extrabold text-blue-700 outline-none cursor-pointer"
            >
              <option value="">Semua Gudang (Global)</option>
              {warehouseBreakdown.map(w => (
                <option key={w.id} value={w.id}>{w.name} ({w.totalStock} pcs)</option>
              ))}
            </select>
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold border border-slate-200 transition"
              title="Perbarui data statistik"
            >
              <RefreshCw size={13} />
              <span>Refresh</span>
            </button>
          )}
        </div>

        {/* Action Shortcuts */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          <a
            href="/pesan-seragam"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition shadow-sm"
          >
            <ExternalLink size={13} className="text-emerald-600" />
            <span>Form Publik ↗</span>
          </a>
        </div>
      </div>

      {/* Hero Alert Banner for Urgent Restock */}
      {urgentRestockCount > 0 && (
        <div className="bg-gradient-to-r from-rose-500 via-rose-600 to-amber-600 text-white rounded-2xl p-4 sm:p-5 shadow-lg shadow-rose-500/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-xl shrink-0 mt-0.5">
              <AlertTriangle size={24} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 font-black text-base sm:text-lg">
                <span>Perhatian: Ada {urgentRestockCount} Varian Seragam Perlu Dipesan Segera!</span>
              </div>
              <p className="text-xs sm:text-sm text-rose-100 mt-1 leading-relaxed">
                Terdapat <strong>{totalIndentDemandQty} pcs antrean inden siswa</strong> dan total <strong>{totalRecommendedQty} pcs rekomendasi pemesanan ke vendor</strong> untuk mencukupi stok aman gudang.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setActiveTableTab('urgent_restock');
              const el = document.getElementById('urgent-restock-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-4 py-2.5 bg-white text-rose-700 hover:bg-rose-50 font-black text-xs rounded-xl shadow-sm transition shrink-0 flex items-center gap-1.5"
          >
            <span>Lihat Daftar Pesan Segera</span>
            <ChevronRight size={15} />
          </button>
        </div>
      )}

      {/* Hero KPI Cards (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Total Stok Fisik & Estimasi Aset */}
        <div className="bg-gradient-to-br from-white to-emerald-50/40 rounded-2xl p-5 border border-emerald-100 shadow-sm relative overflow-hidden group hover:shadow-md transition">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-emerald-500 text-white rounded-xl shadow-md shadow-emerald-500/20">
              <Package size={22} />
            </div>
            <span className="text-[11px] font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
              {stats.warehouses || warehouseBreakdown.length} Gudang
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Stok Fisik</p>
            <h3 className="text-2xl font-black text-slate-800 mt-0.5">
              {Number(totalStock).toLocaleString('id-ID')} <span className="text-xs font-bold text-slate-400">pcs</span>
            </h3>
            <div className="mt-2 pt-2 border-t border-emerald-100/80 flex justify-between items-center text-[11px]">
              <span className="text-slate-500">Estimasi Nilai Aset:</span>
              <span className="font-extrabold text-emerald-700">Rp {Number(totalAssetValue).toLocaleString('id-ID')}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Total Pesanan & Omset */}
        <div className="bg-gradient-to-br from-white to-blue-50/40 rounded-2xl p-5 border border-blue-100 shadow-sm relative overflow-hidden group hover:shadow-md transition">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/20">
              <ShoppingCart size={22} />
            </div>
            <span className="text-[11px] font-extrabold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
              {sales.spmb || 0} SPMB • {sales.retail || 0} Retail
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Pesanan</p>
            <h3 className="text-2xl font-black text-slate-800 mt-0.5">
              {totalSalesCount.toLocaleString('id-ID')} <span className="text-xs font-bold text-slate-400">order</span>
            </h3>
            <div className="mt-2 pt-2 border-t border-blue-100/80 flex justify-between items-center text-[11px]">
              <span className="text-slate-500">Total Nilai Tagihan:</span>
              <span className="font-extrabold text-blue-700">Rp {Number(totalRevenue).toLocaleString('id-ID')}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Kebutuhan Inden & Pesan Segera */}
        <div 
          onClick={() => {
            setActiveTableTab('urgent_restock');
            const el = document.getElementById('urgent-restock-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
          className="bg-gradient-to-br from-white to-amber-50/40 rounded-2xl p-5 border border-amber-100 shadow-sm relative overflow-hidden group hover:shadow-md transition cursor-pointer"
        >
          <div className="flex justify-between items-start">
            <div className="p-3 bg-amber-500 text-white rounded-xl shadow-md shadow-amber-500/20">
              <Clock size={22} />
            </div>
            {urgentRestockCount > 0 ? (
              <span className="text-[11px] font-extrabold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full animate-pulse flex items-center gap-1">
                <AlertTriangle size={11} />
                <span>{urgentRestockCount} Perlu Pesan</span>
              </span>
            ) : (
              <span className="text-[11px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                ✓ Aman
              </span>
            )}
          </div>
          <div className="mt-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kebutuhan Pesan Segera</p>
            <h3 className="text-2xl font-black text-amber-900 mt-0.5">
              {totalRecommendedQty.toLocaleString('id-ID')} <span className="text-xs font-bold text-slate-400">pcs PO</span>
            </h3>
            <div className="mt-2 pt-2 border-t border-amber-100/80 flex justify-between items-center text-[11px]">
              <span className="text-slate-500">Antrean Inden:</span>
              <span className="font-extrabold text-rose-600">{(fulfillment.indent || 0)} item ({criticalCount} darurat)</span>
            </div>
          </div>
        </div>

        {/* Card 4: Realisasi Pembayaran & Kas */}
        <div className="bg-gradient-to-br from-white to-indigo-50/40 rounded-2xl p-5 border border-indigo-100 shadow-sm relative overflow-hidden group hover:shadow-md transition">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-500/20">
              <DollarSign size={22} />
            </div>
            <span className="text-[11px] font-extrabold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
              {paidPercentage}% Lunas
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Kas Masuk</p>
            <h3 className="text-2xl font-black text-slate-800 mt-0.5">
              Rp {Number(totalPaid).toLocaleString('id-ID')}
            </h3>
            <div className="mt-2 pt-2 border-t border-indigo-100/80 flex justify-between items-center text-[11px]">
              <span className="text-slate-500">Sisa Piutang:</span>
              <span className="font-extrabold text-amber-700">Rp {Number(totalUnpaid).toLocaleString('id-ID')}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Middle Section: 2 Columns (Distribusi Gudang & Status Fulfillment) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left: Distribusi Stok per Gudang */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Building size={18} className="text-blue-600" />
              <h3 className="font-extrabold text-slate-800 text-sm">Distribusi Stok per Gudang</h3>
            </div>
            <span className="text-xs font-bold text-slate-400">
              Total {warehouseBreakdown.length} Lokasi
            </span>
          </div>

          <div className="space-y-3.5">
            {warehouseBreakdown.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">Belum ada data gudang aktif.</div>
            ) : warehouseBreakdown.map((w) => {
              const percentage = totalStock > 0 ? Math.round((w.totalStock / totalStock) * 100) : 0;
              return (
                <div key={w.id} className="p-3 bg-slate-50 rounded-xl space-y-2 hover:bg-blue-50/40 transition border border-slate-100">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-bold text-slate-800 text-xs sm:text-sm">{w.name}</span>
                      {w.location && <span className="text-[11px] text-slate-500 ml-1.5">({w.location})</span>}
                    </div>
                    <div className="text-right">
                      <span className="font-black text-slate-800 text-xs sm:text-sm">{w.totalStock.toLocaleString('id-ID')} pcs</span>
                      <span className="text-[10px] text-slate-400 ml-1">({percentage}%)</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-600 rounded-full transition-all duration-500" 
                      style={{ width: `${percentage}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-slate-500 pt-0.5">
                    <span>Estimasi Nilai Barang:</span>
                    <span className="font-bold text-slate-700">Rp {w.totalValue.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Funnel Status Pemrosesan Pesanan */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Layers size={18} className="text-indigo-600" />
              <h3 className="font-extrabold text-slate-800 text-sm">Status Penyerahan & Pemrosesan</h3>
            </div>
            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
              {deliveredPercentage}% Diserahkan
            </span>
          </div>

          {/* Fulfillment Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                <CheckCircle2 size={15} className="text-emerald-600" />
                <span>Siap Ambil (Sedia)</span>
              </div>
              <div className="text-2xl font-black text-emerald-900">
                {(fulfillment.sedia || 0).toLocaleString('id-ID')} <span className="text-xs font-semibold">pcs</span>
              </div>
              <p className="text-[10px] text-emerald-700">Barang siap diserahkan di gudang</p>
            </div>

            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-800">
                <Package size={15} className="text-blue-600" />
                <span>Sudah Diambil</span>
              </div>
              <div className="text-2xl font-black text-blue-900">
                {(fulfillment.diambil || 0).toLocaleString('id-ID')} <span className="text-xs font-semibold">pcs</span>
              </div>
              <p className="text-[10px] text-blue-700">Telah diterima oleh siswa/wali murid</p>
            </div>

            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                <Clock size={15} className="text-amber-600" />
                <span>Menunggu (Indent)</span>
              </div>
              <div className="text-2xl font-black text-amber-950">
                {(fulfillment.indent || 0).toLocaleString('id-ID')} <span className="text-xs font-semibold">pcs</span>
              </div>
              <p className="text-[10px] text-amber-800">Menunggu pasokan stok konveksi</p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <AlertCircle size={15} className="text-slate-500" />
                <span>Dibatalkan</span>
              </div>
              <div className="text-2xl font-black text-slate-800">
                {(fulfillment.batal || 0).toLocaleString('id-ID')} <span className="text-xs font-semibold">pcs</span>
              </div>
              <p className="text-[10px] text-slate-500">Item yang dibatalkan pemesan</p>
            </div>
          </div>

          {/* Progress Bar of Overall Fulfillment */}
          <div className="space-y-1.5 pt-2">
            <div className="flex justify-between text-xs font-bold text-slate-600">
              <span>Progres Penyelesaian Item</span>
              <span>{deliveredPercentage}% Selesai</span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
              <div 
                className="bg-blue-600 h-full" 
                style={{ width: `${totalFulfillmentItems > 0 ? ((fulfillment.diambil || 0) / totalFulfillmentItems) * 100 : 0}%` }}
                title="Sudah Diambil"
              />
              <div 
                className="bg-emerald-500 h-full" 
                style={{ width: `${totalFulfillmentItems > 0 ? ((fulfillment.sedia || 0) / totalFulfillmentItems) * 100 : 0}%` }}
                title="Sedia (Siap Ambil)"
              />
              <div 
                className="bg-amber-400 h-full" 
                style={{ width: `${totalFulfillmentItems > 0 ? ((fulfillment.indent || 0) / totalFulfillmentItems) * 100 : 0}%` }}
                title="Indent"
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-600"></span> Diambil</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Sedia</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400"></span> Indent</span>
            </div>
          </div>
        </div>

      </div>

      {/* Lower Section: 2 Columns (Top 5 Best Sellers & Indent Procurement Radar) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Top 5 Seragam Paling Banyak Dipesan */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-emerald-600" />
              <h3 className="font-extrabold text-slate-800 text-sm">Top 5 Seragam Paling Laris</h3>
            </div>
            <span className="text-xs font-bold text-slate-400">Volume Terbanyak</span>
          </div>

          <div className="space-y-3">
            {topSellingItems.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">Belum ada data transaksi seragam.</div>
            ) : topSellingItems.map((item, idx) => {
              const maxQty = topSellingItems[0]?.qty || 1;
              const barWidth = Math.round((item.qty / maxQty) * 100);
              const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

              return (
                <div key={idx} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2 font-bold text-slate-800">
                      <span>{medals[idx] || '•'}</span>
                      <span>{item.itemName}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-blue-700">{item.qty} pcs</span>
                      <span className="text-[10px] text-slate-400 ml-1.5">(Rp {Number(item.revenue).toLocaleString('id-ID')})</span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full transition-all duration-500" 
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Indent Procurement Radar (Item Paling Banyak Inden) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-amber-600" />
              <h3 className="font-extrabold text-slate-800 text-sm">Kebutuhan Pengadaan (Top Indent)</h3>
            </div>
            <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
              Kebutuhan Konveksi
            </span>
          </div>

          <div className="space-y-2.5">
            {topIndentItems.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-emerald-50/40 rounded-xl border border-emerald-100">
                <CheckCircle2 size={24} className="mx-auto text-emerald-600 mb-1" />
                <span className="font-bold text-emerald-800">Alhamdulillah! Tidak ada antrean indent saat ini.</span>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[220px] overflow-y-auto pr-1">
                {topIndentItems.map((ind, idx) => (
                  <div key={idx} className="py-2 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-xs text-slate-800">{ind.itemName}</div>
                      <div className="text-[10px] text-slate-500">Ukuran: <strong className="text-slate-700">{ind.size}</strong></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-amber-900 bg-amber-100 px-2.5 py-1 rounded-lg">
                        Butuh {ind.count} pcs
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Bottom Tabs: Urgent Restock, Critical Low Stock & Live Activity Timeline */}
      <div id="urgent-restock-section" className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden scroll-mt-20">
        
        {/* Sub-Tabs Header */}
        <div className="flex flex-wrap border-b border-slate-100 bg-slate-50/60 p-2 gap-2">
          
          <button
            onClick={() => setActiveTableTab('urgent_restock')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
              activeTableTab === 'urgent_restock'
                ? 'bg-rose-600 shadow-md shadow-rose-600/20 text-white border border-rose-600'
                : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
            }`}
          >
            <AlertTriangle size={14} className={activeTableTab === 'urgent_restock' ? 'text-white' : 'text-rose-500'} />
            <span>🚨 Daftar Stok yang Harus Segera Dipesan ({urgentRestockCount})</span>
          </button>

          <button
            onClick={() => setActiveTableTab('low_stock')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
              activeTableTab === 'low_stock'
                ? 'bg-amber-500 shadow-md shadow-amber-500/20 text-white border border-amber-500'
                : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
            }`}
          >
            <AlertCircle size={14} className={activeTableTab === 'low_stock' ? 'text-white' : 'text-amber-500'} />
            <span>Peringatan Stok Gudang Kritis ({lowStockCount})</span>
          </button>

          <button
            onClick={() => setActiveTableTab('activity')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
              activeTableTab === 'activity'
                ? 'bg-blue-600 shadow-md shadow-blue-600/20 text-white border border-blue-600'
                : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
            }`}
          >
            <RefreshCw size={14} className={activeTableTab === 'activity' ? 'text-white' : 'text-blue-500'} />
            <span>Riwayat Mutasi & Transaksi</span>
          </button>
        </div>

        {/* Tab 1: Comprehensive Urgent Restock Radar (Rekomendasi Pesan Segera) */}
        {activeTableTab === 'urgent_restock' && (
          <div className="p-4 sm:p-5 space-y-4">
            
            {/* Filter Chips & Search Bar for Urgent Restock */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              
              {/* Filter Chips */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
                <button
                  onClick={() => setRestockFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl transition ${
                    restockFilter === 'ALL'
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Semua Rekomendasi ({urgentRestockItems.length})
                </button>

                <button
                  onClick={() => setRestockFilter('CRITICAL_URGENT')}
                  className={`px-3 py-1.5 rounded-xl flex items-center gap-1 transition ${
                    restockFilter === 'CRITICAL_URGENT'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'bg-rose-50 border border-rose-200 text-rose-800 hover:bg-rose-100'
                  }`}
                >
                  🔴 Darurat & Kurang Stok ({criticalCount})
                </button>

                <button
                  onClick={() => setRestockFilter('OUT_OF_STOCK')}
                  className={`px-3 py-1.5 rounded-xl flex items-center gap-1 transition ${
                    restockFilter === 'OUT_OF_STOCK'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100'
                  }`}
                >
                  🟠 Stok Habis / 0 ({outOfStockCount})
                </button>

                <button
                  onClick={() => setRestockFilter('LOW_STOCK')}
                  className={`px-3 py-1.5 rounded-xl flex items-center gap-1 transition ${
                    restockFilter === 'LOW_STOCK'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100'
                  }`}
                >
                  🟡 Menipis (&le; Min)
                </button>
              </div>

              {/* Search & Export Buttons */}
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari nama seragam, ukuran..."
                    value={restockSearch}
                    onChange={(e) => setRestockSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-rose-200 transition"
                  />
                </div>

                <button
                  onClick={handleExportRestockCSV}
                  disabled={filteredUrgentItems.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition disabled:opacity-50"
                  title="Unduh daftar pengadaan seragam dalam format Excel/CSV"
                >
                  <Download size={13} />
                  <span>Unduh Pengadaan (.csv)</span>
                </button>
              </div>

            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-xs sm:text-sm">
                <thead className="bg-slate-50 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="p-3 text-center w-12">No</th>
                    <th className="p-3 text-left">Nama Seragam & Jenjang</th>
                    <th className="p-3 text-center">Ukuran</th>
                    <th className="p-3 text-center">Sisa Stok</th>
                    <th className="p-3 text-center">Inden Siswa</th>
                    <th className="p-3 text-center">Target Min</th>
                    <th className="p-3 text-center">Rekomendasi Pesan (PO)</th>
                    <th className="p-3 text-center">Urgensi</th>
                    <th className="p-3 text-left">Gudang</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUrgentItems.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="p-8 text-center text-slate-400 bg-slate-50/50">
                        <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-1.5" />
                        <span className="font-bold text-slate-700">Tidak ada stok yang mendesak untuk dipesan sesuai filter saat ini.</span>
                      </td>
                    </tr>
                  ) : filteredUrgentItems.map((item, idx) => {
                    const isCritical = item.urgency === 'CRITICAL';
                    const isUrgent = item.urgency === 'URGENT';
                    const isOut = item.currentStock <= 0;

                    return (
                      <tr 
                        key={idx} 
                        className={`hover:bg-slate-50/80 transition ${
                          isCritical 
                            ? 'bg-rose-50/40 border-l-4 border-l-rose-500 font-semibold' 
                            : isUrgent 
                            ? 'bg-amber-50/30 border-l-4 border-l-amber-500' 
                            : isOut 
                            ? 'bg-amber-50/15'
                            : ''
                        }`}
                      >
                        <td className="p-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                        <td className="p-3">
                          <div className="font-bold text-slate-800 text-xs sm:text-sm">{item.itemName}</div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-semibold">{item.unitName}</span>
                            <span>• {item.gender}</span>
                            {item.sku && <span>• SKU: {item.sku}</span>}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <Badge color="blue">{item.sizeName}</Badge>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`font-black text-xs px-2 py-0.5 rounded ${
                            isOut ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {item.currentStock} pcs
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          {item.totalIndentDemand > 0 ? (
                            <span className="font-black text-xs text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
                              {item.totalIndentDemand} pcs
                            </span>
                          ) : (
                            <span className="text-slate-400 font-medium">-</span>
                          )}
                        </td>
                        <td className="p-3 text-center text-slate-400 font-semibold text-xs">
                          {item.minStock} pcs
                        </td>
                        <td className="p-3 text-center">
                          <span className="font-black text-xs sm:text-sm text-emerald-800 bg-emerald-100 border border-emerald-300 px-3 py-1 rounded-xl shadow-xs inline-block">
                            + {item.recommendedQty} pcs
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            isCritical ? 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse' :
                            isUrgent ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                            isOut ? 'bg-orange-100 text-orange-800 border border-orange-200' :
                            'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                            {item.urgencyLabel}
                          </span>
                        </td>
                        <td className="p-3 text-slate-500 text-[11px]">
                          {item.warehouseBreakdown || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table Footer Summary */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs flex flex-wrap justify-between items-center gap-3">
              <div className="text-slate-600 font-bold">
                Menampilkan <span className="text-blue-700 font-black">{filteredUrgentItems.length}</span> varian seragam yang perlu pengadaan segera.
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div>
                  <span className="text-slate-500 font-medium">Total Inden Siswa: </span>
                  <strong className="text-amber-800 font-black">{totalIndentDemandQty} pcs</strong>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Total Rekomendasi Pesan: </span>
                  <strong className="text-emerald-700 font-black">{totalRecommendedQty} pcs</strong>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Tab 2: Critical Low Stock Table */}
        {activeTableTab === 'low_stock' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="p-3 text-left">Nama Seragam</th>
                  <th className="p-3 text-center">Ukuran</th>
                  <th className="p-3 text-left">Lokasi Gudang</th>
                  <th className="p-3 text-center">Sisa Stok</th>
                  <th className="p-3 text-center">Batas Min</th>
                  <th className="p-3 text-center">Status Defisit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lowStockItems.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-slate-400">
                      Alhamdulillah, semua stok seragam dalam kondisi aman (di atas batas minimal).
                    </td>
                  </tr>
                ) : lowStockItems.map((s, i) => {
                  const qty = Number(s.quantity);
                  const min = Number(s.minStock);
                  const isOut = qty <= 0;

                  return (
                    <tr key={i} className="hover:bg-slate-50/80 transition">
                      <td className="p-3 font-bold text-slate-800">{s.itemName}</td>
                      <td className="p-3 text-center"><Badge color="blue">{s.sizeName}</Badge></td>
                      <td className="p-3 text-slate-600 text-xs">{s.warehouseName}</td>
                      <td className="p-3 text-center">
                        <span className={`font-black text-xs px-2 py-0.5 rounded ${
                          isOut ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {qty} pcs
                        </span>
                      </td>
                      <td className="p-3 text-center text-slate-400 font-semibold text-xs">{min} pcs</td>
                      <td className="p-3 text-center">
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                          isOut ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {isOut ? 'HABIS (0)' : `Kurang ${min - qty} pcs`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Recent Activity Timeline */}
        {activeTableTab === 'activity' && (
          <div className="p-4 divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
            {recentActivity.length === 0 ? (
              <div className="p-8 text-center text-slate-400">Belum ada riwayat mutasi atau transaksi terbaru.</div>
            ) : recentActivity.map((act) => (
              <div key={act.id} className="py-3 flex items-start justify-between gap-3 hover:bg-slate-50/60 p-2 rounded-xl transition">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-xl text-xs font-bold shrink-0 ${
                    act.type === 'IN' ? 'bg-green-100 text-green-700' :
                    act.type === 'OUT' ? 'bg-rose-100 text-rose-700' :
                    act.type === 'EXCHANGE' ? 'bg-amber-100 text-amber-800' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {act.type === 'IN' ? <ArrowDownRight size={16} /> :
                     act.type === 'OUT' ? <ArrowUpRight size={16} /> :
                     <RefreshCw size={16} />}
                  </div>
                  <div>
                    <div className="font-bold text-xs sm:text-sm text-slate-800 flex items-center gap-2">
                      <span>{act.title}</span>
                      <span className="text-[11px] font-semibold text-blue-700 font-mono">
                        {act.itemName} ({act.size})
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      <span>Lokasi: <strong className="text-slate-700">{act.warehouse}</strong></span>
                      {act.toWarehouse && <span> ➔ <strong className="text-slate-700">{act.toWarehouse}</strong></span>}
                      {act.note && <span className="italic ml-1 text-slate-400">• {act.note}</span>}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-black text-xs text-slate-800">{act.qty} pcs</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {new Date(act.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

    </div>
  );
};
