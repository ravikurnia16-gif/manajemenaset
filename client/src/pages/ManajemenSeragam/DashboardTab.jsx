import React, { useState } from 'react';
import { 
  Shirt, Package, AlertCircle, ShoppingCart, TrendingUp, Clock, 
  Building, CheckCircle2, ArrowUpRight, ArrowDownRight, RefreshCw, 
  ExternalLink, Layers, ChevronRight, DollarSign, Sparkles, Filter
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
  const [activeTableTab, setActiveTableTab] = useState('low_stock'); // 'low_stock' | 'activity' | 'indent'

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

        {/* Card 3: Kebutuhan Inden & Stok Kritis */}
        <div className="bg-gradient-to-br from-white to-amber-50/40 rounded-2xl p-5 border border-amber-100 shadow-sm relative overflow-hidden group hover:shadow-md transition">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-amber-500 text-white rounded-xl shadow-md shadow-amber-500/20">
              <Clock size={22} />
            </div>
            {fulfillment.indent > 0 ? (
              <span className="text-[11px] font-extrabold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full animate-pulse">
                ⏳ Perlu Pengadaan
              </span>
            ) : (
              <span className="text-[11px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                ✓ Aman
              </span>
            )}
          </div>
          <div className="mt-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Antrean Indent Seragam</p>
            <h3 className="text-2xl font-black text-amber-900 mt-0.5">
              {(fulfillment.indent || 0).toLocaleString('id-ID')} <span className="text-xs font-bold text-slate-400">item inden</span>
            </h3>
            <div className="mt-2 pt-2 border-t border-amber-100/80 flex justify-between items-center text-[11px]">
              <span className="text-slate-500">Stok Menipis (&le; Min):</span>
              <span className="font-extrabold text-rose-600">{lowStockCount} varian ukuran</span>
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

      {/* Bottom Tabs: Critical Low Stock & Live Activity Timeline */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        
        {/* Sub-Tabs Header */}
        <div className="flex border-b border-slate-100 bg-slate-50/60 p-2 gap-2">
          <button
            onClick={() => setActiveTableTab('low_stock')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
              activeTableTab === 'low_stock'
                ? 'bg-white shadow text-rose-700 border border-rose-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <AlertCircle size={14} className="text-rose-500" />
            <span>Peringatan Stok Kritis ({lowStockCount})</span>
          </button>

          <button
            onClick={() => setActiveTableTab('activity')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
              activeTableTab === 'activity'
                ? 'bg-white shadow text-blue-700 border border-blue-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <RefreshCw size={14} className="text-blue-500" />
            <span>Riwayat Mutasi & Tukar Ukuran Terbaru</span>
          </button>
        </div>

        {/* Tab 1: Critical Low Stock Table */}
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

        {/* Tab 2: Recent Activity Timeline */}
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
