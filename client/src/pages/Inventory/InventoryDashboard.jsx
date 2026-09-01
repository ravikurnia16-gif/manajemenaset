import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Package, AlertTriangle, ShoppingCart, RefreshCw, ArrowUpRight, 
  TrendingUp, TrendingDown, Layers, Building2, CheckCircle2, ArrowRight, 
  FolderTree, Clock, FileText, ShoppingBag, Plus, Sparkles, AlertCircle, ArrowDownRight
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend } from 'recharts';
import api from '../../lib/axios';
import { getMediaUrl } from '../../lib/media';

export default function InventoryDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await api.get('/inventory/dashboard/summary');
      setData(res.data);
    } catch (e) {
      console.error('Failed to fetch inventory dashboard:', e);
      setError(e.response?.data?.error || e.message || 'Gagal memuat data dashboard logistik');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
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
  const alertItems = data?.alertItems || [];
  const recentPendingOrders = data?.recentPendingOrders || [];
  const recentTransactions = data?.recentTransactions || [];
  const categoryChartData = data?.categoryChartData || [];
  const orderStatusData = data?.orderStatusData || [];

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
            Ringkasan stok barang, mutasi, pengajuan unit, dan status gudang yayasan.
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
