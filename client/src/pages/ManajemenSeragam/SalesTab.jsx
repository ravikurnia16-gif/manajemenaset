import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, ShoppingCart, Trash2, CheckCircle, XCircle, ChevronDown, ChevronUp, 
  Sparkles, CheckCheck, Package, MapPin, AlertCircle, Save, X, ExternalLink, Clock, Filter, Globe, Copy
} from 'lucide-react';
import { Badge } from './UIComponents';

const InlineFulfillPanel = ({ sale, warehouses = [], onSave, onClose }) => {
  const [itemUpdates, setItemUpdates] = useState([]);
  const [commonWarehouseId, setCommonWarehouseId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (sale) {
      let initial = [];
      if (sale.items) {
        initial = sale.items.map(i => {
          let initialStatus = i.status || 'PENDING';
          const totalStock = i.variant?.stocks?.reduce((acc, s) => acc + s.quantity, 0) || 0;
          
          // Auto-deteksi stok jika masih PENDING
          if (initialStatus === 'PENDING' && i.variant?.stocks) {
            initialStatus = totalStock >= i.qty ? 'SEDIA' : 'TIDAK_TERSEDIA';
          }

          // Auto-select warehouse jika hanya ada 1 gudang dengan stok
          const availableStocks = i.variant?.stocks?.filter(s => s.quantity > 0) || [];
          let defWhId = '';
          if (availableStocks.length === 1) {
            defWhId = String(availableStocks[0].warehouseId);
          }

          return {
            saleItemId: i.id,
            variantId: i.variantId,
            name: i.itemName,
            size: i.size,
            qty: i.qty,
            oldStatus: i.status || 'PENDING',
            status: initialStatus,
            sourceWarehouseId: defWhId,
            transitWarehouseId: defWhId,
            returnWarehouseId: '',
            isMoved: false,
            totalStock,
            stocks: i.variant?.stocks || []
          };
        });
      }

      // Append Nama Dada from note if present
      if (sale.note && sale.note.includes('[NAMADADA')) {
        const matches = [...sale.note.matchAll(/\[(NAMADADA(?:_PUTIH|_COKLAT)?):(\d+):(\d+)(?::([A-Z_]+))?\]/g)];
        for (const match of matches) {
          const ndType = match[1];
          const ndQty = parseInt(match[2]);
          const ndStatus = match[4] || 'PENDING';
          
          let name = 'Nama Dada (Bordir)';
          if (ndType === 'NAMADADA_PUTIH') name += ' - Putih';
          if (ndType === 'NAMADADA_COKLAT') name += ' - Coklat';

          initial.push({
            saleItemId: ndType,
            name: name,
            size: '-',
            qty: ndQty,
            oldStatus: ndStatus,
            status: ndStatus,
            sourceWarehouseId: '',
            transitWarehouseId: '',
            returnWarehouseId: '',
            isMoved: false,
            totalStock: 9999,
            stocks: []
          });
        }
      }

      setItemUpdates(initial);
    }
  }, [sale]);

  // Aksi Cepat: Terapkan Gudang Bersama ke Seluruh Item
  const handleApplyCommonWarehouse = (whId) => {
    setCommonWarehouseId(whId);
    if (!whId) return;
    setItemUpdates(prev => prev.map(item => ({
      ...item,
      sourceWarehouseId: whId,
      transitWarehouseId: item.isMoved ? item.transitWarehouseId : whId
    })));
  };

  // Aksi Cepat: Set Semua SEDIA (Stok Cukup)
  const handleSetAllSedia = () => {
    setItemUpdates(prev => prev.map(item => {
      const isNd = String(item.saleItemId).startsWith('NAMADADA');
      const hasStock = isNd || item.totalStock >= item.qty;
      const newStatus = hasStock ? 'SEDIA' : 'TIDAK_TERSEDIA';
      
      let whId = item.sourceWarehouseId || commonWarehouseId;
      if (!whId && item.stocks?.length > 0) {
        const stockWithQty = item.stocks.find(s => s.quantity > 0);
        if (stockWithQty) whId = String(stockWithQty.warehouseId);
      }

      return {
        ...item,
        status: newStatus,
        sourceWarehouseId: whId || '',
        transitWarehouseId: item.isMoved ? item.transitWarehouseId : (whId || '')
      };
    }));
  };

  // Aksi Cepat: Set Semua DIAMBIL (Diserahkan)
  const handleSetAllDiambil = () => {
    setItemUpdates(prev => prev.map(item => {
      let whId = item.sourceWarehouseId || commonWarehouseId;
      return {
        ...item,
        status: 'DIAMBIL',
        sourceWarehouseId: whId || ''
      };
    }));
  };

  // Aksi Cepat: Set Semua INDENT
  const handleSetAllIndent = () => {
    setItemUpdates(prev => prev.map(item => ({
      ...item,
      status: 'INDENT'
    })));
  };

  const handleStatusChange = (index, newStatus) => {
    setItemUpdates(prev => {
      const next = [...prev];
      next[index].status = newStatus;
      if (newStatus === 'SEDIA' && commonWarehouseId && !next[index].sourceWarehouseId) {
        next[index].sourceWarehouseId = commonWarehouseId;
        if (!next[index].isMoved) next[index].transitWarehouseId = commonWarehouseId;
      }
      return next;
    });
  };

  const handleWhChange = (index, field, value) => {
    setItemUpdates(prev => {
      const next = [...prev];
      next[index][field] = value;
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    
    // Validasi
    for (const item of itemUpdates) {
      if (item.status === item.oldStatus) continue;
      if (String(item.saleItemId).startsWith('NAMADADA')) continue;

      if (['PENDING', 'INDENT', 'BACKORDER', 'TIDAK_TERSEDIA'].includes(item.oldStatus) && item.status === 'SEDIA') {
        if (item.isMoved) {
          if (!item.sourceWarehouseId || !item.transitWarehouseId) {
            alert(`Pilih gudang asal dan gudang tujuan untuk memindahkan item: ${item.name}`);
            return;
          }
        } else {
          if (!item.sourceWarehouseId) {
            alert(`Pilih lokasi gudang tempat pengambilan untuk item: ${item.name}`);
            return;
          }
        }
      } else if (item.status === 'BATAL' && item.oldStatus === 'SEDIA') {
        if (!item.transitWarehouseId || !item.returnWarehouseId) {
          alert(`Pilih gudang transit dan gudang pengembalian untuk membatalkan item: ${item.name}`);
          return;
        }
      } else if (item.status === 'BATAL' && item.oldStatus === 'DIAMBIL') {
        if (!item.returnWarehouseId) {
          alert(`Pilih gudang pengembalian untuk item: ${item.name}`);
          return;
        }
      }
    }

    const payload = itemUpdates
      .filter(i => i.status !== i.oldStatus)
      .map(i => ({
        saleItemId: i.saleItemId,
        status: i.status,
        sourceWarehouseId: i.sourceWarehouseId,
        transitWarehouseId: i.isMoved ? i.transitWarehouseId : (i.status === 'SEDIA' ? i.sourceWarehouseId : (i.transitWarehouseId || i.returnWarehouseId)),
        returnWarehouseId: i.returnWarehouseId
      }));

    if (payload.length === 0) {
      alert('Tidak ada perubahan status item.');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(payload);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const totalChanged = itemUpdates.filter(i => i.status !== i.oldStatus).length;
  const currentIndentItems = itemUpdates.filter(i => i.status === 'INDENT' || i.status === 'TIDAK_TERSEDIA');

  return (
    <div className="bg-gradient-to-b from-blue-50/70 to-indigo-50/40 p-4 sm:p-5 rounded-2xl border border-blue-200/80 shadow-inner space-y-4 animate-in fade-in zoom-in-95 duration-200">
      
      {/* Header & Quick Action Bar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 pb-3 border-b border-blue-200/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
            <Package size={16} />
          </div>
          <div>
            <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
              Kelola Item: <span className="font-mono text-blue-700">{sale?.code}</span>
              <span className="text-slate-400 font-normal">({sale?.customerName})</span>
            </div>
            <p className="text-xs text-slate-500">
              Total {itemUpdates.length} item seragam terdaftar pada pesanan ini.
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <button
            type="button"
            onClick={handleSetAllSedia}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
            title="Set semua item yang stoknya ada menjadi SEDIA"
          >
            <Sparkles size={13} /> Set Semua SEDIA
          </button>

          <button
            type="button"
            onClick={handleSetAllDiambil}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
            title="Set semua item menjadi DIAMBIL (Sudah Diserahkan)"
          >
            <CheckCheck size={13} /> Set Semua DIAMBIL
          </button>

          <button
            type="button"
            onClick={handleSetAllIndent}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold transition"
            title="Set semua item menjadi INDENT"
          >
            ⏳ Set Semua INDENT
          </button>

          {/* Quick Common Warehouse Selector */}
          <div className="flex items-center gap-1 bg-white border border-blue-200 rounded-xl px-2.5 py-1 text-xs shadow-sm">
            <MapPin size={13} className="text-blue-600 shrink-0" />
            <select
              value={commonWarehouseId}
              onChange={(e) => handleApplyCommonWarehouse(e.target.value)}
              className="bg-transparent font-bold text-slate-700 outline-none text-xs"
            >
              <option value="">-- Lokasi Gudang Pengambilan (Semua) --</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name} {w.location ? `(${w.location})` : ''}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Indent Alert Banner if any item is INDENT */}
      {currentIndentItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-900 shadow-sm animate-in fade-in">
          <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-bold flex items-center gap-1.5">
              <span>⏳ Terdapat {currentIndentItems.length} Item dalam Status INDENT / Belum Siap</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Daftar item inden: <span className="font-semibold">{currentIndentItems.map(i => `${i.name} (${i.size})`).join(', ')}</span>.
            </p>
          </div>
        </div>
      )}

      {/* Items List Cards / Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-1">
        {itemUpdates.map((item, idx) => {
          const changed = item.status !== item.oldStatus;
          const isNd = String(item.saleItemId).startsWith('NAMADADA');
          const hasStock = isNd || item.totalStock >= item.qty;
          const isItemIndent = item.status === 'INDENT' || item.status === 'TIDAK_TERSEDIA';

          return (
            <div 
              key={item.saleItemId}
              className={`p-3.5 rounded-xl border transition-all ${
                isItemIndent
                  ? 'bg-amber-50/60 border-amber-300 ring-1 ring-amber-400/30'
                  : changed 
                  ? 'bg-blue-50/90 border-blue-300 ring-1 ring-blue-400/30' 
                  : 'bg-white border-slate-200/80 shadow-sm'
              }`}
            >
              <div className="flex justify-between items-start gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-800 text-xs sm:text-sm truncate flex items-center gap-1.5" title={item.name}>
                    {isItemIndent && <span className="text-amber-600">⏳</span>}
                    <span>{item.name}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2 mt-0.5">
                    <span>Ukuran: <strong className="text-slate-700">{item.size}</strong></span>
                    <span>•</span>
                    <span>Qty: <strong className="text-slate-700">{item.qty} pcs</strong></span>
                    {!isNd && (
                      <>
                        <span>•</span>
                        <span className={`inline-flex items-center gap-1 font-extrabold ${hasStock ? 'text-emerald-600' : 'text-rose-600'}`}>
                          Stok: {item.totalStock} {hasStock ? '✓' : '(Kurang)'}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Status Selector */}
                <div className="flex flex-col items-end shrink-0">
                  <div className="text-[10px] text-slate-400 font-medium mb-1">
                    Status: <span className="font-bold text-slate-600">{item.oldStatus}</span>
                  </div>
                  <select
                    value={item.status}
                    onChange={(e) => handleStatusChange(idx, e.target.value)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border outline-none shadow-sm transition ${
                      item.status === 'SEDIA' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' :
                      item.status === 'DIAMBIL' ? 'bg-blue-50 text-blue-700 border-blue-300' :
                      item.status === 'INDENT' ? 'bg-amber-50 text-amber-800 border-amber-300 font-extrabold' :
                      item.status === 'TIDAK_TERSEDIA' ? 'bg-rose-50 text-rose-700 border-rose-300' :
                      item.status === 'BATAL' ? 'bg-slate-100 text-slate-700 border-slate-300' :
                      'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="SEDIA">SEDIA (Siap Ambil)</option>
                    <option value="DIAMBIL">DIAMBIL (Diserahkan)</option>
                    <option value="INDENT">INDENT (Menunggu)</option>
                    <option value="TIDAK_TERSEDIA">TIDAK TERSEDIA</option>
                    <option value="BATAL">BATAL</option>
                  </select>
                </div>
              </div>

              {/* Warehouse selector options */}
              {changed && (
                <div className="pt-2.5 mt-2 border-t border-slate-100/80 text-xs space-y-2">
                  {/* Case 1: Nama Dada -> SEDIA */}
                  {isNd && ['PENDING', 'INDENT', 'BACKORDER', 'TIDAK_TERSEDIA'].includes(item.oldStatus) && item.status === 'SEDIA' && (
                    <div className="flex gap-2 items-center">
                      <label className="text-[11px] font-bold text-slate-500 shrink-0">Lokasi Penjemputan:</label>
                      <select
                        required
                        className="flex-1 bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-medium"
                        value={item.transitWarehouseId}
                        onChange={(e) => handleWhChange(idx, 'transitWarehouseId', e.target.value)}
                      >
                        <option value="">-- Pilih Lokasi Gudang --</option>
                        {warehouses.map(w => (
                          <option key={w.id} value={w.id}>{w.name} {w.location ? `(${w.location})` : ''}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Case 2: Regular Item -> SEDIA */}
                  {!isNd && ['PENDING', 'INDENT', 'BACKORDER', 'TIDAK_TERSEDIA', 'BATAL'].includes(item.oldStatus) && item.status === 'SEDIA' && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-600">
                          {item.isMoved ? 'Gudang Asal & Tujuan:' : 'Gudang Tempat Pengambilan:'}
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-blue-600 font-bold">
                          <input 
                            type="checkbox" 
                            checked={item.isMoved} 
                            onChange={(e) => handleWhChange(idx, 'isMoved', e.target.checked)} 
                            className="rounded text-blue-600" 
                          />
                          Pindah Gudang?
                        </label>
                      </div>

                      <div className="flex gap-2">
                        <select
                          required
                          className="flex-1 bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-medium"
                          value={item.sourceWarehouseId}
                          onChange={(e) => handleWhChange(idx, 'sourceWarehouseId', e.target.value)}
                        >
                          <option value="">{item.isMoved ? '-- Gudang Asal --' : '-- Gudang Pengambilan --'}</option>
                          {warehouses.map(w => {
                            const st = item.stocks?.find(s => s.warehouseId === w.id);
                            return (
                              <option key={w.id} value={w.id}>
                                {w.name} {st ? `(Stok: ${st.quantity})` : '(Stok: 0)'}
                              </option>
                            );
                          })}
                        </select>

                        {item.isMoved && (
                          <select
                            required
                            className="flex-1 bg-white border border-blue-300 rounded-lg p-1.5 text-xs font-medium"
                            value={item.transitWarehouseId}
                            onChange={(e) => handleWhChange(idx, 'transitWarehouseId', e.target.value)}
                          >
                            <option value="">-- Gudang Tujuan --</option>
                            {warehouses.map(w => (
                              <option key={w.id} value={w.id}>{w.name} {w.location ? `(${w.location})` : ''}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Case 3: Regular Item -> DIAMBIL */}
                  {!isNd && item.status === 'DIAMBIL' && (
                    <div>
                      {item.oldStatus === 'SEDIA' ? (
                        <p className="text-[11px] text-slate-500 italic">
                          *Stok akan otomatis terpotong dari riwayat gudang saat barang diset SEDIA.
                        </p>
                      ) : (
                        <div className="flex gap-2 items-center">
                          <label className="text-[11px] font-bold text-slate-500 shrink-0">Gudang Asal:</label>
                          <select
                            required
                            className="flex-1 bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-medium"
                            value={item.sourceWarehouseId}
                            onChange={(e) => handleWhChange(idx, 'sourceWarehouseId', e.target.value)}
                          >
                            <option value="">-- Terjual Langsung Dari Gudang Mana? --</option>
                            {warehouses.map(w => {
                              const st = item.stocks?.find(s => s.warehouseId === w.id);
                              return (
                                <option key={w.id} value={w.id}>
                                  {w.name} {st ? `(Stok: ${st.quantity})` : '(Stok: 0)'}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Case 4: Item -> BATAL */}
                  {!isNd && item.status === 'BATAL' && ['SEDIA', 'DIAMBIL'].includes(item.oldStatus) && (
                    <div className="flex gap-2">
                      {item.oldStatus === 'SEDIA' && (
                        <select
                          required
                          className="flex-1 bg-white border border-slate-200 rounded-lg p-1.5 text-xs"
                          value={item.transitWarehouseId}
                          onChange={(e) => handleWhChange(idx, 'transitWarehouseId', e.target.value)}
                        >
                          <option value="">-- Gudang Transit Mana? --</option>
                          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                      )}
                      <select
                        required
                        className="flex-1 bg-white border border-slate-200 rounded-lg p-1.5 text-xs"
                        value={item.returnWarehouseId}
                        onChange={(e) => handleWhChange(idx, 'returnWarehouseId', e.target.value)}
                      >
                        <option value="">-- Gudang Pengembalian --</option>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Actions */}
      <div className="flex flex-wrap justify-between items-center gap-3 pt-3 border-t border-blue-200/60 bg-white/50 p-2.5 rounded-xl">
        <div className="text-xs text-slate-500 flex items-center gap-2">
          {totalChanged > 0 ? (
            <span className="font-bold text-blue-700 bg-blue-100/80 px-2.5 py-1 rounded-lg">
              {totalChanged} item mengalami perubahan status
            </span>
          ) : (
            <span>Belum ada perubahan status item.</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition"
          >
            Tutup Dropdown
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving || totalChanged === 0}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-500/20 disabled:opacity-50"
          >
            <Save size={14} />
            {isSaving ? 'Menyimpan...' : 'Simpan Perubahan & Kirim WA'}
          </button>
        </div>
      </div>

    </div>
  );
};

export const SalesTab = ({ 
  sales = [], loading, search, setSearch, openModal, canFulfill, warehouses = [], onFulfillSale, onDelete, onUpdatePayment 
}) => {
  const [expandedSaleIds, setExpandedSaleIds] = useState(new Set());
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'INDENT' | 'PROSES' | 'COMPLETED'
  const [copied, setCopied] = useState(false);

  const handleCopyPublicLink = () => {
    const url = `${window.location.origin}/pesan-seragam`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleExpand = (id) => {
    setExpandedSaleIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Helper untuk menentukan prioritas sorting:
  // 1: PENDING (Paling atas)
  // 2: PROSES dengan Item INDENT (Tinggi)
  // 3: PROSES / SEDIA (Menengah)
  // 4: SELESAI / COMPLETED (Paling bawah)
  // 5: CANCELLED / BATAL (Paling bawah sekali)
  const getStatusPriority = (sale) => {
    const status = sale.status || '';
    const hasIndent = sale.items?.some(i => i.status === 'INDENT' || i.status === 'TIDAK_TERSEDIA');

    if (status === 'PENDING') return 1;
    if (status === 'PROSES' || status === 'SEDIA') {
      if (hasIndent) return 2; // Ada barang indent
      return 3;
    }
    if (status === 'SELESAI' || status === 'COMPLETED') return 4;
    if (status === 'CANCELLED' || status === 'BATAL') return 5;
    return 3;
  };

  // Hitung jumlah per status untuk filter chips
  const counts = useMemo(() => {
    let pending = 0;
    let indent = 0;
    let proses = 0;
    let completed = 0;

    sales.forEach(s => {
      const hasIndent = s.items?.some(i => i.status === 'INDENT' || i.status === 'TIDAK_TERSEDIA');
      if (s.status === 'PENDING') pending++;
      if (hasIndent && s.status !== 'SELESAI' && s.status !== 'COMPLETED' && s.status !== 'CANCELLED') indent++;
      if ((s.status === 'PROSES' || s.status === 'SEDIA') && !hasIndent) proses++;
      if (s.status === 'SELESAI' || s.status === 'COMPLETED') completed++;
    });

    return { all: sales.length, pending, indent, proses, completed };
  }, [sales]);

  // Urutkan data: PENDING paling atas, INDENT berikutnya, PROSES, dan SELESAI paling bawah
  const sortedAndFilteredSales = useMemo(() => {
    let list = [...sales];

    // Filter status jika dipilih
    if (statusFilter === 'PENDING') {
      list = list.filter(s => s.status === 'PENDING');
    } else if (statusFilter === 'INDENT') {
      list = list.filter(s => s.items?.some(i => i.status === 'INDENT' || i.status === 'TIDAK_TERSEDIA') && s.status !== 'SELESAI' && s.status !== 'COMPLETED');
    } else if (statusFilter === 'PROSES') {
      list = list.filter(s => (s.status === 'PROSES' || s.status === 'SEDIA'));
    } else if (statusFilter === 'COMPLETED') {
      list = list.filter(s => s.status === 'SELESAI' || s.status === 'COMPLETED');
    }

    // Urutkan berdasarkan prioritas status lalu tanggal terbaru
    return list.sort((a, b) => {
      const pA = getStatusPriority(a);
      const pB = getStatusPriority(b);
      if (pA !== pB) return pA - pB;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }, [sales, statusFilter]);

  return (
    <div className="space-y-4">
      {/* Top Search, Public Link Buttons & Create Bar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
        <div className="flex flex-wrap gap-2 items-center flex-1 max-w-lg w-full">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Cari kode invoice, nama pelanggan, atau siswa..." 
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-100 transition-all" 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
          </div>
        </div>

        {/* Action Buttons: Public Form Link & Create Admin Order */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Tombol Buka Form Publik */}
          <a
            href="/pesan-seragam"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition shadow-sm"
            title="Buka Halaman Form Pemesanan Seragam Publik untuk Wali Murid"
          >
            <Globe size={14} className="text-emerald-600" />
            <span>Form Pesan Seragam Publik</span>
            <ExternalLink size={12} className="text-emerald-500" />
          </a>

          {/* Tombol Salin Link */}
          <button
            type="button"
            onClick={handleCopyPublicLink}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition shadow-sm"
            title="Salin Link Pemesanan Publik untuk Dibagikan ke Wali Murid via WhatsApp"
          >
            {copied ? (
              <>
                <CheckCheck size={14} className="text-emerald-600" />
                <span className="text-emerald-600">Tersalin!</span>
              </>
            ) : (
              <>
                <Copy size={13} className="text-slate-500" />
                <span>Salin Link</span>
              </>
            )}
          </button>

          {/* Tombol Buat Pesanan (Admin) */}
          <button 
            onClick={() => openModal('sale')} 
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all shrink-0"
          >
            <ShoppingCart size={14} /> Buat Pesanan
          </button>
        </div>
      </div>

      {/* Quick Status Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
        <button
          onClick={() => setStatusFilter('ALL')}
          className={`px-3 py-1.5 rounded-xl transition ${
            statusFilter === 'ALL'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Semua Pesanan ({counts.all})
        </button>

        <button
          onClick={() => setStatusFilter('PENDING')}
          className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition ${
            statusFilter === 'PENDING'
              ? 'bg-amber-500 text-white shadow-sm'
              : 'bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100'
          }`}
        >
          <Clock size={13} /> 
          Pending ({counts.pending})
        </button>

        <button
          onClick={() => setStatusFilter('INDENT')}
          className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition ${
            statusFilter === 'INDENT'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-amber-100/70 border border-amber-300 text-amber-900 hover:bg-amber-200'
          }`}
        >
          ⏳ Ada Indent ({counts.indent})
        </button>

        <button
          onClick={() => setStatusFilter('PROSES')}
          className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition ${
            statusFilter === 'PROSES'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100'
          }`}
        >
          🔵 Diproses ({counts.proses})
        </button>

        <button
          onClick={() => setStatusFilter('COMPLETED')}
          className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition ${
            statusFilter === 'COMPLETED'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100'
          }`}
        >
          ✓ Selesai ({counts.completed})
        </button>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="p-3 text-left">Invoice</th>
              <th className="p-3 text-left">Pelanggan & Siswa</th>
              <th className="p-3 text-center">Tipe</th>
              <th className="p-3 text-right">Total Tagihan</th>
              <th className="p-3 text-center">Pembayaran</th>
              <th className="p-3 text-center">Status & Kelola</th>
              <th className="p-3 text-center">Tanggal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan="7" className="p-8 text-center text-slate-400">Memuat data pesanan...</td></tr>
            ) : sortedAndFilteredSales.length === 0 ? (
              <tr><td colSpan="7" className="p-8 text-center text-slate-400">Belum ada transaksi pesanan yang sesuai filter.</td></tr>
            ) : sortedAndFilteredSales.map(s => {
              const hasPackages = s.salePackages && s.salePackages.length > 0;
              const activeSubtotal = (s.type === 'SPMB' || s.type === 'UNIT_ORDER')
                ? s.subtotal
                : (s.items?.filter(item => item.status !== 'BATAL').reduce((acc, item) => acc + item.totalPrice, 0) || s.subtotal);
              const activeTotalAmount = Math.max(0, activeSubtotal - (s.discount || 0));
              const isExpanded = expandedSaleIds.has(s.id);
              const itemCount = s.items?.length || 0;

              // Identifikasi item Indent & Sedia
              const indentItems = s.items?.filter(i => i.status === 'INDENT' || i.status === 'TIDAK_TERSEDIA') || [];
              const sediaItems = s.items?.filter(i => i.status === 'SEDIA') || [];
              const isCompleted = s.status === 'SELESAI' || s.status === 'COMPLETED';

              return (
                <React.Fragment key={s.id}>
                  <tr className={`hover:bg-slate-50/80 transition-colors ${
                    isExpanded 
                      ? 'bg-blue-50/40' 
                      : indentItems.length > 0 && !isCompleted 
                      ? 'bg-amber-50/20' 
                      : isCompleted 
                      ? 'bg-slate-50/30 opacity-80 hover:opacity-100' 
                      : ''
                  }`}>
                    
                    {/* Invoice */}
                    <td className="p-3">
                      <div className="font-mono text-xs font-bold text-slate-700">{s.code}</div>
                      {indentItems.length > 0 && !isCompleted && (
                        <div className="text-[10px] font-extrabold text-amber-700 flex items-center gap-1 mt-0.5">
                          ⏳ Ada {indentItems.length} Inden
                        </div>
                      )}
                    </td>

                    {/* Pelanggan */}
                    <td className="p-3">
                      <div className="font-bold text-slate-800">{s.customerName}</div>
                      {s.studentName && <div className="text-[11px] text-slate-500">Siswa: <span className="font-semibold text-slate-700">{s.studentName}</span> {s.studentClass ? `(${s.studentClass})` : ''}</div>}
                    </td>

                    {/* Tipe */}
                    <td className="p-3 text-center">
                      <Badge color={s.type === 'SPMB' || s.type === 'UNIT_ORDER' ? 'purple' : 'slate'}>
                        {s.type}
                      </Badge>
                    </td>

                    {/* Total Tagihan */}
                    <td className="p-3 text-right">
                      {s.totalAmount > activeTotalAmount ? (
                        <div className="flex flex-col items-end">
                          <span className="text-xs text-rose-400 line-through" title="Total Awal">Rp {(s.totalAmount).toLocaleString('id-ID')}</span>
                          <span className="font-bold text-slate-800" title="Total Setelah Batal">Rp {activeTotalAmount.toLocaleString('id-ID')}</span>
                        </div>
                      ) : (
                        <span className="font-bold text-slate-800">Rp {activeTotalAmount.toLocaleString('id-ID')}</span>
                      )}
                    </td>

                    {/* Status Bayar */}
                    <td className="p-3 text-center">
                      <Badge color={s.paymentStatus === 'PAID' ? 'green' : s.paymentStatus === 'PARTIAL' ? 'orange' : 'red'}>
                        {s.paymentStatus}
                      </Badge>
                      {onUpdatePayment && (
                        <button 
                          onClick={() => onUpdatePayment(s.id, s.paymentStatus === 'PAID' ? 'UNPAID' : 'PAID')}
                          className={`mt-1.5 mx-auto flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg transition-colors ${
                            s.paymentStatus === 'PAID' 
                              ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                              : 'bg-green-50 text-green-600 hover:bg-green-100'
                          }`}
                        >
                          {s.paymentStatus === 'PAID' ? <XCircle size={11} /> : <CheckCircle size={11} />}
                          {s.paymentStatus === 'PAID' ? 'Batal Lunas' : 'Tandai Lunas'}
                        </button>
                      )}
                    </td>

                    {/* Status & Kelola Item Toggle */}
                    <td className="p-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <Badge color={
                          isCompleted ? 'green' : 
                          s.status === 'PROSES' || s.status === 'SEDIA' ? 'blue' : 
                          s.status === 'PENDING' ? 'yellow' : 'slate'
                        }>
                          {s.status === 'COMPLETED' ? 'SELESAI' : s.status}
                        </Badge>

                        {/* Indent Indicator Badge if any items are INDENT */}
                        {indentItems.length > 0 && !isCompleted && (
                          <span 
                            className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full shadow-sm"
                            title={`Item Indent: ${indentItems.map(i => i.itemName + ' (' + i.size + ')').join(', ')}`}
                          >
                            ⏳ {indentItems.length} Indent
                          </span>
                        )}

                        {/* Sedia Indicator Badge if any items are SEDIA */}
                        {sediaItems.length > 0 && !isCompleted && indentItems.length === 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                            ✓ {sediaItems.length} Sedia
                          </span>
                        )}
                      </div>

                      {canFulfill && s.status !== 'CANCELLED' && (
                        <button 
                          onClick={() => toggleExpand(s.id)} 
                          className={`mt-1.5 text-xs font-bold px-2.5 py-1 rounded-xl transition-all flex items-center justify-center gap-1 mx-auto whitespace-nowrap ${
                            isExpanded 
                              ? 'bg-indigo-600 text-white shadow-sm' 
                              : indentItems.length > 0 && !isCompleted
                              ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                              : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/60'
                          }`}
                          title="Buka / Tutup Kelola Item Langsung"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp size={13} /> Tutup Item
                            </>
                          ) : (
                            <>
                              <ChevronDown size={13} /> Kelola {itemCount} Item
                            </>
                          )}
                        </button>
                      )}
                    </td>

                    {/* Tanggal & Link */}
                    <td className="p-3 text-center">
                      <div className="text-xs text-slate-500 mb-1">
                        {new Date(s.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                      </div>
                      <div className="flex items-center justify-center gap-1.5">
                        <a 
                          href={`/public/invoice-seragam/${s.id}`} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-[10px] font-bold text-blue-600 hover:underline inline-flex items-center gap-0.5 bg-blue-50 px-2 py-0.5 rounded-lg"
                        >
                          Invoice <ExternalLink size={10} />
                        </a>
                        {s.status === 'PENDING' && onDelete && (
                          <button 
                            onClick={() => onDelete(s.id)} 
                            className="text-[10px] font-bold text-red-500 hover:text-red-700 p-1 bg-red-50 rounded" 
                            title="Batalkan Pesanan"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Accordion Expandable Row for Inline Fulfill */}
                  {isExpanded && (
                    <tr className="bg-blue-50/20 border-b border-indigo-100">
                      <td colSpan="7" className="p-3 sm:p-4">
                        <InlineFulfillPanel 
                          sale={s} 
                          warehouses={warehouses} 
                          onSave={async (fulfillments) => {
                            if (onFulfillSale) {
                              await onFulfillSale(s.id, fulfillments);
                              toggleExpand(s.id);
                            }
                          }} 
                          onClose={() => toggleExpand(s.id)} 
                        />
                      </td>
                    </tr>
                  )}

                  {/* Sub Package Rows (if any) */}
                  {hasPackages && s.salePackages.map((pkg) => {
                    const pkgItems = s.items ? s.items.filter(i => i.salePackageId === pkg.id) : [];
                    const isPkgPending = pkgItems.some(i => i.qtyDelivered < i.qty);
                    
                    return (
                      <tr key={pkg.id} className="bg-slate-50/60 border-t border-slate-100 text-xs">
                        <td colSpan="2" className="p-2.5 pl-8 text-slate-600 border-r border-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400">└</span>
                            <span className="font-bold">{pkg.package?.name || 'Paket'}</span>
                            <span className="bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded text-[10px]">{pkg.qty}x</span>
                          </div>
                        </td>
                        <td colSpan="3" className="p-2.5 border-r border-slate-100 text-slate-500">
                          Harga: Rp {pkg.price.toLocaleString('id-ID')}
                        </td>
                        <td colSpan="2" className="p-2.5">
                          {isPkgPending ? (
                            <div className="text-[10px] font-bold text-yellow-600 text-center bg-yellow-50 rounded py-0.5 border border-yellow-100">
                              Ada Item Pending/Proses
                            </div>
                          ) : (
                            <div className="text-[10px] font-bold text-green-600 text-center bg-green-50 rounded py-0.5 border border-green-100">
                              Semua Item Selesai
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};


