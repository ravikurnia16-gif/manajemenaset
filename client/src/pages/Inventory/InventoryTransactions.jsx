import React, { useState, useEffect } from 'react';
import { 
  Plus, ArrowRightLeft, ArrowDownToLine, ArrowUpFromLine, Search, 
  Info, Sparkles, Filter, CheckCircle, Clock, Package, RefreshCw, Upload
} from 'lucide-react';
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
      setFormData({ ...formData, quantity: '', note: '' });
      fetchTransactions();
      alert('Transakasi stok berhasil dicatat & stok ter-update!');
    } catch (error) {
      alert(error.response?.data?.error || 'Terjadi kesalahan saat memproses transaksi');
    }
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

  const filteredTransactions = transactions.filter(t => 
    t.code.toLowerCase().includes(search.toLowerCase()) ||
    t.item?.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.note && t.note.toLowerCase().includes(search.toLowerCase()))
  );

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
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Buat Transaksi Manual
        </button>
      </div>

      {/* Info Banner: Otomatisasi Stok */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
        <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
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
        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-4 bg-slate-50 items-center justify-between">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Cari kode TRX, nama barang, atau catatan..."
              className="pl-10 pr-4 py-2 w-full border border-slate-200 bg-white rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <select 
              className="border border-slate-200 bg-white px-3 py-2 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">Semua Tipe Transaksi</option>
              <option value="IN">Stok Masuk (IN)</option>
              <option value="OUT">Stok Keluar (OUT)</option>
              <option value="MUTATION">Mutasi Gudang (MUTATION)</option>
            </select>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-100">
                <th className="p-4">Tanggal & Kode</th>
                <th className="p-4">Tipe & Asal</th>
                <th className="p-4">Barang</th>
                <th className="p-4">Gudang Sumber / Tujuan</th>
                <th className="p-4 text-center">Kuantitas</th>
                <th className="p-4">Keterangan</th>
                <th className="p-4">Petugas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="7" className="p-8 text-center text-slate-400">Memuat riwayat transaksi...</td></tr>
              ) : filteredTransactions.length === 0 ? (
                <tr><td colSpan="7" className="p-8 text-center text-slate-400">Tidak ada transaksi ditemukan.</td></tr>
              ) : (
                filteredTransactions.map((trx) => {
                  const autoTrx = isAutoTransaction(trx.note);
                  return (
                    <tr key={trx.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-sm text-slate-800">
                          {new Date(trx.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">{trx.code}</div>
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
                      <td className="p-4 text-sm">
                        <div className="text-slate-800 font-medium"><span className="text-slate-400 text-xs">Dari:</span> {trx.warehouse?.name || '-'}</div>
                        {trx.toWarehouse && (
                          <div className="text-blue-600 font-semibold mt-0.5"><span className="text-slate-400 text-xs">Ke:</span> {trx.toWarehouse.name}</div>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-base font-extrabold text-slate-800">{trx.quantity}</span>{' '}
                        <span className="text-xs font-medium text-slate-500">{trx.item?.unit}</span>
                      </td>
                      <td className="p-4 text-xs text-slate-600 max-w-xs truncate" title={trx.note}>
                        {trx.note || '-'}
                      </td>
                      <td className="p-4 text-xs font-medium text-slate-500">
                        {trx.createdBy?.name || trx.createdBy?.username || 'Sistem Admin'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL BUAT TRANSAKSI MANUAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Plus size={18} className="text-blue-600" /> Catat Transaksi Manual
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold text-xl">&times;</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tanggal</label>
                  <input type="date" required className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tipe Transaksi</label>
                  <select required className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                    <option value="IN">Stok Masuk (IN)</option>
                    <option value="OUT">Stok Keluar (OUT)</option>
                    <option value="MUTATION">Mutasi Antar Gudang</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Pilih Barang</label>
                <select required className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.itemId} onChange={e => setFormData({...formData, itemId: e.target.value})}>
                  <option value="">-- Pilih Barang --</option>
                  {items.map(it => <option key={it.id} value={it.id}>{it.code} - {it.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Gudang / Lokasi (Sumber)</label>
                <select required className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.warehouseId} onChange={e => setFormData({...formData, warehouseId: e.target.value})}>
                  <option value="">-- Pilih Gudang --</option>
                  {warehouses.map(wh => <option key={wh.id} value={wh.id}>{wh.name}</option>)}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">Gudang tempat stok ditambah (IN) atau dikurangi (OUT/MUTASI).</p>
              </div>

              {formData.type === 'MUTATION' && (
                <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 space-y-1">
                  <label className="block text-xs font-bold text-blue-900 uppercase">Gudang Tujuan Mutasi</label>
                  <select required className="w-full bg-white border border-blue-200 rounded-lg p-2 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.toWarehouseId} onChange={e => setFormData({...formData, toWarehouseId: e.target.value})}>
                    <option value="">-- Pilih Gudang Tujuan --</option>
                    {warehouses.map(wh => <option key={wh.id} value={wh.id}>{wh.name}</option>)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Kuantitas</label>
                  <input type="number" min="1" required className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Keterangan / Catatan</label>
                <textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500" rows="2"
                  placeholder="Contoh: Penerimaan barang dari suplier atau penyesuaian stok opname..."
                  value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})}></textarea>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50">Batal</button>
                <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/20">Simpan Transaksi</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

