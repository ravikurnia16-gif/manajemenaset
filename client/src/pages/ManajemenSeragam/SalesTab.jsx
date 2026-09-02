import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, ShoppingCart, Trash2, CheckCircle, XCircle, ChevronDown, ChevronUp, 
  Sparkles, CheckCheck, Package, MapPin, AlertCircle, Save, X, ExternalLink, Clock, Filter, Globe, Copy, RefreshCw, Download, AlertTriangle, Loader2,
  CreditCard, Coins, DollarSign, Receipt, Send
} from 'lucide-react';
import api from '../../lib/axios';
import { Badge } from './UIComponents';

const InlineFulfillPanel = ({ sale, warehouses = [], variants = [], onSave, onClose }) => {
  const [itemUpdates, setItemUpdates] = useState([]);
  const [commonWarehouseId, setCommonWarehouseId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (sale) {
      let initial = [];
      if (sale.items) {
        initial = sale.items.map(i => {
          let initialStatus = i.status || 'PENDING';
          const matchedVariant = variants.find(v => String(v.id) === String(i.variantId)) || i.variant;
          const stocksList = (matchedVariant?.stocks && matchedVariant.stocks.length > 0)
            ? matchedVariant.stocks
            : (i.variant?.stocks || []);
          const totalStock = stocksList.reduce((acc, s) => acc + (s.quantity || 0), 0);
          
          // Auto-deteksi stok jika masih PENDING
          if (initialStatus === 'PENDING') {
            initialStatus = totalStock >= i.qty ? 'SEDIA' : 'TIDAK_TERSEDIA';
          }

          // Auto-select warehouse jika hanya ada 1 gudang dengan stok
          const availableStocks = stocksList.filter(s => (s.quantity || 0) > 0);
          let defWhId = '';
          if (availableStocks.length === 1) {
            defWhId = String(availableStocks[0].warehouseId);
          }

          return {
            saleItemId: i.id,
            variantId: i.variantId,
            itemId: matchedVariant?.itemId || i.variant?.itemId,
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
            stocks: stocksList,
            isSizeChanged: false
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
            variantId: null,
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
            stocks: [],
            isSizeChanged: false
          });
        }
      }

      setItemUpdates(initial);
    }
  }, [sale, variants]);

  // Ganti Ukuran Item Sebelum Diambil
  const handleSizeChange = (index, newVariantId) => {
    const newV = variants.find(v => String(v.id) === String(newVariantId));
    if (!newV) return;

    setItemUpdates(prev => {
      const next = [...prev];
      const item = next[index];
      const totalStock = newV.stocks?.reduce((acc, s) => acc + s.quantity, 0) || 0;
      const hasStock = totalStock >= item.qty;

      const availableStocks = newV.stocks?.filter(s => s.quantity > 0) || [];
      let defWhId = item.sourceWarehouseId;
      if (!defWhId && availableStocks.length === 1) {
        defWhId = String(availableStocks[0].warehouseId);
      }

      let newStatus = item.status;
      if (item.status === 'SEDIA' && !hasStock) {
        newStatus = 'INDENT';
      } else if (item.status === 'INDENT' && hasStock) {
        newStatus = 'SEDIA';
      }

      next[index] = {
        ...item,
        variantId: newV.id,
        size: newV.sizeName,
        name: newV.item?.name || item.name,
        totalStock,
        stocks: newV.stocks || [],
        status: newStatus,
        sourceWarehouseId: defWhId || '',
        transitWarehouseId: item.isMoved ? item.transitWarehouseId : (defWhId || ''),
        isSizeChanged: true
      };
      return next;
    });
  };

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
    <div className="bg-gradient-to-b from-blue-50/70 to-indigo-50/40 p-3.5 sm:p-5 rounded-2xl border border-blue-200/80 shadow-inner space-y-4 animate-in fade-in zoom-in-95 duration-200">
      
      {/* Header & Quick Action Bar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 pb-3 border-b border-blue-200/60">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-sm shrink-0">
            <Package size={16} />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-2 flex-wrap">
              <span>Kelola Item: <span className="font-mono text-blue-700">{sale?.code}</span></span>
              <span className="text-slate-400 font-normal truncate">({sale?.customerName})</span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500">
              Total {itemUpdates.length} item seragam terdaftar pada pesanan ini.
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <button
            type="button"
            onClick={handleSetAllSedia}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm whitespace-nowrap"
            title="Set semua item yang stoknya ada menjadi SEDIA"
          >
            <Sparkles size={13} /> Set Semua SEDIA
          </button>

          <button
            type="button"
            onClick={handleSetAllDiambil}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm whitespace-nowrap"
            title="Set semua item menjadi DIAMBIL (Sudah Diserahkan)"
          >
            <CheckCheck size={13} /> Set Semua DIAMBIL
          </button>

          <button
            type="button"
            onClick={handleSetAllIndent}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold transition whitespace-nowrap"
            title="Set semua item menjadi INDENT"
          >
            ⏳ Set Semua INDENT
          </button>

          {/* Quick Common Warehouse Selector */}
          <div className="w-full sm:w-auto flex items-center gap-1.5 bg-white border border-blue-200 rounded-xl px-2.5 py-1.5 text-xs shadow-sm">
            <MapPin size={13} className="text-blue-600 shrink-0" />
            <select
              value={commonWarehouseId}
              onChange={(e) => handleApplyCommonWarehouse(e.target.value)}
              className="w-full sm:w-auto bg-transparent font-bold text-slate-700 outline-none text-xs truncate cursor-pointer"
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
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5 max-h-[55vh] overflow-y-auto pr-1 custom-scrollbar">
        {itemUpdates.map((item, idx) => {
          const changed = item.status !== item.oldStatus;
          const isNd = String(item.saleItemId).startsWith('NAMADADA');
          const hasStock = isNd || item.totalStock >= item.qty;
          const isItemIndent = item.status === 'INDENT' || item.status === 'TIDAK_TERSEDIA';

          const currentV = (Array.isArray(variants) ? variants : []).find(v => String(v.id) === String(item.variantId));
          const itemIdToMatch = item.itemId || currentV?.itemId;
          const availableSizes = itemIdToMatch
            ? (Array.isArray(variants) ? variants : []).filter(v => String(v.itemId) === String(itemIdToMatch))
            : [];

          return (
            <div 
              key={item.saleItemId}
              className={`p-3.5 sm:p-4 rounded-xl border transition-all space-y-2.5 ${
                isItemIndent
                  ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-400/30'
                  : changed 
                  ? 'bg-blue-50/90 border-blue-300 ring-1 ring-blue-400/30' 
                  : 'bg-white border-slate-200/80 shadow-sm'
              }`}
            >
              {/* Card Header: Item Name, Old Status, and Status Selector */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100/90">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5 flex-wrap" title={item.name}>
                    {isItemIndent && <span className="text-amber-600">⏳</span>}
                    <span className="break-words">{item.name}</span>
                    {item.isSizeChanged && (
                      <span className="text-[10px] bg-blue-600 text-white font-extrabold px-2 py-0.5 rounded-full">
                        Ukuran Diubah
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-slate-400 font-medium mt-0.5 flex items-center gap-1.5">
                    <span>Status Awal:</span>
                    <span className="font-bold text-slate-600 px-1.5 py-0.2 bg-slate-100 rounded text-[10px]">{item.oldStatus}</span>
                  </div>
                </div>

                {/* Status Selector Dropdown */}
                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                  <label className="text-[10px] font-bold text-slate-400 uppercase sm:hidden">Ubah:</label>
                  <select
                    value={item.status}
                    onChange={(e) => handleStatusChange(idx, e.target.value)}
                    className={`flex-1 sm:flex-initial px-2.5 py-1.5 rounded-xl text-xs font-bold border outline-none shadow-sm transition cursor-pointer ${
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

              {/* Card Middle: Size selector, Qty, and Available Stocks Info */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-50/90 p-2.5 rounded-xl border border-slate-100">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-slate-500 font-medium">Ukuran:</span>
                  {!isNd && item.oldStatus !== 'DIAMBIL' && availableSizes.length > 1 ? (
                    <select
                      value={item.variantId}
                      onChange={(e) => handleSizeChange(idx, e.target.value)}
                      className="bg-white hover:bg-blue-50 text-blue-900 font-black border border-blue-300 rounded-lg px-2 py-1 text-xs outline-none cursor-pointer shadow-sm transition max-w-[170px]"
                      title="Klik untuk mengubah ukuran seragam yang dipesan"
                    >
                      {availableSizes.map(v => {
                        const vStock = v.stocks?.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0) || 0;
                        return (
                          <option key={v.id} value={v.id}>
                            {v.sizeName} (Stok: {vStock})
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <strong className="text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded text-xs">
                      {item.size}
                    </strong>
                  )}
                </div>

                <div className="flex items-center gap-2.5 text-xs flex-wrap">
                  <div className="text-slate-600">
                    Qty: <strong className="text-slate-800">{item.qty} pcs</strong>
                  </div>
                  {!isNd && (
                    <div className={`font-extrabold flex items-center gap-1 text-[11px] ${hasStock ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : 'text-rose-700 bg-rose-50 border border-rose-200'} px-2 py-0.5 rounded`}>
                      <span>Stok: {item.totalStock}</span>
                      <span>{hasStock ? '✓' : '(Kurang)'}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Warehouse selector options */}
              {changed && (
                <div className="pt-2 mt-1 border-t border-slate-100 text-xs space-y-2">
                  {/* Case 1: Nama Dada -> SEDIA */}
                  {isNd && ['PENDING', 'INDENT', 'BACKORDER', 'TIDAK_TERSEDIA'].includes(item.oldStatus) && item.status === 'SEDIA' && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
                      <label className="text-[11px] font-bold text-slate-600 shrink-0">Lokasi Penjemputan:</label>
                      <select
                        required
                        className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-medium outline-none focus:border-blue-400"
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
                    <div className="space-y-2 bg-blue-50/50 p-2.5 rounded-xl border border-blue-100">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <label className="text-[11px] font-bold text-slate-700">
                          {item.isMoved ? 'Alur Pemindahan Gudang:' : 'Gudang Pengambilan Barang:'}
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-blue-700 font-bold bg-white px-2 py-0.5 rounded-lg border border-blue-200 hover:bg-blue-50 transition">
                          <input 
                            type="checkbox" 
                            checked={item.isMoved} 
                            onChange={(e) => handleWhChange(idx, 'isMoved', e.target.checked)} 
                            className="rounded text-blue-600 focus:ring-blue-500" 
                          />
                          Pindah Gudang?
                        </label>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-500 block">
                            {item.isMoved ? '1. Gudang Asal (Stok Diambil):' : 'Pilih Gudang Pengambilan:'}
                          </span>
                          <select
                            required
                            className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-medium outline-none focus:border-blue-400"
                            value={item.sourceWarehouseId}
                            onChange={(e) => handleWhChange(idx, 'sourceWarehouseId', e.target.value)}
                          >
                            <option value="">-- Pilih Gudang Asal --</option>
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

                        {item.isMoved && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-blue-700 block">
                              2. Gudang Tujuan (Tempat Jemput):
                            </span>
                            <select
                              required
                              className="w-full bg-white border border-blue-300 rounded-xl p-2 text-xs font-medium outline-none focus:border-blue-500"
                              value={item.transitWarehouseId}
                              onChange={(e) => handleWhChange(idx, 'transitWarehouseId', e.target.value)}
                            >
                              <option value="">-- Pilih Gudang Tujuan --</option>
                              {warehouses.map(w => (
                                <option key={w.id} value={w.id}>{w.name} {w.location ? `(${w.location})` : ''}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Case 3: Regular Item -> DIAMBIL */}
                  {!isNd && item.status === 'DIAMBIL' && (
                    <div className="space-y-1.5">
                      {item.oldStatus === 'SEDIA' ? (
                        <p className="text-[11px] text-slate-500 italic bg-white/70 p-2 rounded-lg border border-slate-100">
                          * Stok otomatis terpotong dari gudang yang dipilih saat status diset SEDIA.
                        </p>
                      ) : (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
                          <label className="text-[11px] font-bold text-slate-600 shrink-0">Gudang Asal Barang:</label>
                          <select
                            required
                            className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-medium outline-none focus:border-blue-400"
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {item.oldStatus === 'SEDIA' && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-500 block">Gudang Transit Sebelumnya:</span>
                          <select
                            required
                            className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs outline-none focus:border-blue-400"
                            value={item.transitWarehouseId}
                            onChange={(e) => handleWhChange(idx, 'transitWarehouseId', e.target.value)}
                          >
                            <option value="">-- Pilih Gudang Transit --</option>
                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                          </select>
                        </div>
                      )}
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 block">Gudang Pengembalian Stok:</span>
                        <select
                          required
                          className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs outline-none focus:border-blue-400"
                          value={item.returnWarehouseId}
                          onChange={(e) => handleWhChange(idx, 'returnWarehouseId', e.target.value)}
                        >
                          <option value="">-- Pilih Gudang Pengembalian --</option>
                          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-3 border-t border-blue-200/60 bg-white/70 p-3 rounded-xl">
        <div className="text-xs text-slate-500 flex items-center gap-2">
          {totalChanged > 0 ? (
            <span className="font-bold text-blue-700 bg-blue-100/90 border border-blue-200 px-3 py-1 rounded-lg">
              {totalChanged} item mengalami perubahan status
            </span>
          ) : (
            <span className="text-slate-500 font-medium">Belum ada perubahan status item.</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 sm:flex-initial px-4 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition text-center"
          >
            Tutup Panel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving || totalChanged === 0}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-500/20 disabled:opacity-50 text-center"
          >
            <Save size={14} />
            {isSaving ? 'Menyimpan...' : 'Simpan Perubahan & Kirim WA'}
          </button>
        </div>
      </div>

    </div>
  );
};

const PaymentManagementModal = ({ sale, isOpen, onClose, onSave }) => {
  if (!isOpen || !sale) return null;

  let ndTotal = 0;
  if (sale.note && sale.note.includes('[NAMADADA')) {
    const matches = [...sale.note.matchAll(/\[(NAMADADA(?:_PUTIH|_COKLAT)?):(\d+):(\d+)(?::([A-Z_]+))?\]/g)];
    for (const m of matches) {
      if (m[4] !== 'BATAL') {
        ndTotal += (parseInt(m[2]) || 0) * (parseInt(m[3]) || 0);
      }
    }
  }

  const activeSubtotal = (sale.type === 'SPMB' || sale.type === 'UNIT_ORDER')
    ? (Number(sale.subtotal) || 0)
    : ((sale.items?.filter(item => item.status !== 'BATAL').reduce((acc, item) => acc + (Number(item.totalPrice) || 0), 0) || 0) + ndTotal);
  const totalAmount = Math.max(0, activeSubtotal - (Number(sale.discount) || 0));
  const currentPaid = Number(sale.paidAmount) || 0;
  const currentRemaining = Math.max(0, totalAmount - currentPaid);

  // Total harga item yang sudah siap (SEDIA) atau sudah diserahkan (DIAMBIL)
  const items = Array.isArray(sale.items) ? sale.items : [];
  const readyDeliveredItemTotal = items
    .filter(i => (i.status === 'SEDIA' || i.status === 'DIAMBIL') && i.status !== 'BATAL')
    .reduce((acc, i) => acc + (Number(i.totalPrice) || 0), 0);

  const [inputPaid, setInputPaid] = useState(currentPaid);
  const [paymentMethod, setPaymentMethod] = useState(sale.paymentMethod || 'TRANSFER');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const numInputPaid = Number(inputPaid) || 0;
  const sisaBayar = Math.max(0, totalAmount - numInputPaid);

  let previewStatus = 'UNPAID';
  if (numInputPaid >= totalAmount && totalAmount > 0) {
    previewStatus = 'PAID';
  } else if (numInputPaid > 0) {
    previewStatus = 'PARTIAL';
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave(sale.id, {
        paidAmount: Math.min(totalAmount, numInputPaid),
        paymentStatus: previewStatus,
        paymentMethod
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 rounded-xl">
              <CreditCard size={20} />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base">Kelola Pembayaran Tagihan</h3>
              <p className="text-xs text-blue-100 font-mono">{sale.code} • {sale.customerName}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
          {/* Tagihan Summary Card */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">Total Tagihan:</span>
              <strong className="text-slate-800 text-sm">Rp {totalAmount.toLocaleString('id-ID')}</strong>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">Sudah Dibayar Saat Ini:</span>
              <span className="font-bold text-emerald-600">Rp {currentPaid.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200">
              <span className="text-slate-500 font-medium">Sisa Belum Dibayar:</span>
              <strong className="text-rose-600 text-sm">Rp {currentRemaining.toLocaleString('id-ID')}</strong>
            </div>

            {/* Progress bar */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-slate-500">Persentase Terbayar</span>
                <span className="text-blue-600">{totalAmount > 0 ? Math.min(100, Math.round((numInputPaid / totalAmount) * 100)) : 100}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${numInputPaid >= totalAmount ? 'bg-emerald-500' : numInputPaid > 0 ? 'bg-amber-500' : 'bg-slate-300'}`}
                  style={{ width: `${totalAmount > 0 ? Math.min(100, Math.max(0, (numInputPaid / totalAmount) * 100)) : 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* Quick Buttons */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">Pilihan Cepat Nominal:</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setInputPaid(totalAmount)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  numInputPaid === totalAmount
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                }`}
              >
                <CheckCircle size={13} /> Lunas Penuh (100%)
              </button>

              {readyDeliveredItemTotal > 0 && readyDeliveredItemTotal < totalAmount && (
                <button
                  type="button"
                  onClick={() => setInputPaid(readyDeliveredItemTotal)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    numInputPaid === readyDeliveredItemTotal
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-300'
                  }`}
                  title="Bayar seharga item seragam yang statusnya sudah SEDIA atau DIAMBIL"
                >
                  <Package size={13} /> Item Siap/Ambil
                </button>
              )}

              <button
                type="button"
                onClick={() => setInputPaid(0)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  numInputPaid === 0
                    ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                    : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300'
                }`}
              >
                <XCircle size={13} /> Belum Bayar (Rp 0)
              </button>
            </div>
          </div>

          {/* Input Nominal Pembayaran */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex justify-between items-center">
              <span>Total Uang yang Diterima (Rp):</span>
              <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full ${
                previewStatus === 'PAID' ? 'bg-emerald-100 text-emerald-800' :
                previewStatus === 'PARTIAL' ? 'bg-amber-100 text-amber-800' :
                'bg-rose-100 text-rose-800'
              }`}>
                Status: {previewStatus === 'PAID' ? 'LUNAS' : previewStatus === 'PARTIAL' ? 'PARSIAL (SEBAGIAN)' : 'BELUM BAYAR'}
              </span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">Rp</span>
              <input
                type="number"
                min="0"
                max={totalAmount}
                value={inputPaid}
                onChange={(e) => setInputPaid(Math.min(totalAmount, Math.max(0, parseFloat(e.target.value) || 0)))}
                placeholder="0"
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl font-mono font-bold text-base text-slate-800 outline-none"
              />
            </div>
            <div className="flex justify-between text-xs text-slate-500 pt-0.5">
              <span>Sisa Tagihan Setelah Ini:</span>
              <strong className={sisaBayar > 0 ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}>
                Rp {sisaBayar.toLocaleString('id-ID')}
              </strong>
            </div>
          </div>

          {/* Metode Pembayaran */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">Metode Pembayaran:</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'TRANSFER', label: 'Transfer Bank' },
                { key: 'CASH', label: 'Tunai (Cash)' },
                { key: 'QRIS', label: 'QRIS' }
              ].map(m => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setPaymentMethod(m.key)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    paymentMethod === m.key
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition text-center cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-500/20 disabled:opacity-50 text-center cursor-pointer"
            >
              <Save size={14} />
              {isSubmitting ? 'Menyimpan...' : 'Simpan Pembayaran'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const SalesTab = ({ 
  sales = [], 
  type = 'ALL',
  loading, 
  search, 
  setSearch, 
  openModal, 
  canFulfill, 
  warehouses = [], 
  variants = [], 
  onFulfillSale, 
  onDelete, 
  onUpdatePayment 
}) => {
  const [expandedSaleIds, setExpandedSaleIds] = useState(new Set());
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'INDENT' | 'PROSES' | 'COMPLETED'
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [paymentModal, setPaymentModal] = useState({ open: false, sale: null });

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

  // Helper untuk mengekstrak seluruh item (termasuk Nama Dada bordir dari note)
  const getSaleItemsAndNd = (sale) => {
    if (!sale) return { items: [], ndItems: [], allItems: [] };
    const items = Array.isArray(sale.items) ? sale.items : [];
    const ndItems = [];
    if (sale.note && typeof sale.note === 'string' && sale.note.includes('[NAMADADA')) {
      const matches = [...sale.note.matchAll(/\[(NAMADADA(?:_PUTIH|_COKLAT)?):(\d+):(\d+)(?::([A-Z_]+))?\]/g)];
      for (const m of matches) {
        const ndType = m[1];
        const ndQty = parseInt(m[2]) || 1;
        const ndPrice = parseInt(m[3]) || 0;
        const ndStatus = m[4] || 'PENDING';
        let name = 'Nama Dada (Bordir)';
        if (ndType === 'NAMADADA_PUTIH') name += ' - Putih';
        if (ndType === 'NAMADADA_COKLAT') name += ' - Coklat';
        ndItems.push({
          isNd: true,
          ndType,
          itemName: name,
          size: '-',
          qty: ndQty,
          unitPrice: ndPrice,
          totalPrice: ndQty * ndPrice,
          status: ndStatus
        });
      }
    }
    return { items, ndItems, allItems: [...items, ...ndItems] };
  };

  const checkSaleHasIndent = (sale) => {
    const { allItems } = getSaleItemsAndNd(sale);
    return allItems.some(i => i.status === 'INDENT' || i.status === 'TIDAK_TERSEDIA');
  };

  // Helper untuk menentukan prioritas sorting:
  // 1: PENDING (Paling atas)
  // 2: PROSES dengan Item INDENT (Tinggi)
  // 3: PROSES / SEDIA (Menengah)
  // 4: SELESAI / COMPLETED (Paling bawah)
  // 5: CANCELLED / BATAL (Paling bawah sekali)
  const getStatusPriority = (sale) => {
    if (!sale) return 3;
    const status = sale.status || '';
    const hasIndent = checkSaleHasIndent(sale);

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
    let overdue30 = 0;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const safeSales = Array.isArray(sales) ? sales : [];

    safeSales.forEach(s => {
      if (!s) return;
      const isDone = s.status === 'SELESAI' || s.status === 'COMPLETED' || s.status === 'CANCELLED' || s.status === 'BATAL';
      const hasIndent = checkSaleHasIndent(s);
      const { allItems } = getSaleItemsAndNd(s);
      const isReady = s.status === 'PROSES' || s.status === 'SEDIA' || allItems.some(i => i.status === 'SEDIA');
      const orderDate = new Date(s.updatedAt || s.createdAt || 0);

      if (s.status === 'PENDING') pending++;
      if (hasIndent && !isDone) indent++;
      if ((s.status === 'PROSES' || s.status === 'SEDIA') && !hasIndent) proses++;
      if (s.status === 'SELESAI' || s.status === 'COMPLETED') completed++;

      if (!isDone && isReady && orderDate <= thirtyDaysAgo) {
        overdue30++;
      }
    });

    return { all: safeSales.length, pending, indent, proses, completed, overdue30 };
  }, [sales]);

  // Urutkan data: PENDING paling atas, INDENT berikutnya, PROSES, dan SELESAI paling bawah
  // Khusus status SELESAI diurutkan berdasarkan waktu selesai (completedAt) terbaru
  const sortedAndFilteredSales = useMemo(() => {
    let list = Array.isArray(sales) ? [...sales] : [];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Filter status jika dipilih
    if (statusFilter === 'PENDING') {
      list = list.filter(s => s?.status === 'PENDING');
    } else if (statusFilter === 'INDENT') {
      list = list.filter(s => checkSaleHasIndent(s) && s?.status !== 'SELESAI' && s?.status !== 'COMPLETED' && s?.status !== 'CANCELLED' && s?.status !== 'BATAL');
    } else if (statusFilter === 'PROSES') {
      list = list.filter(s => (s?.status === 'PROSES' || s?.status === 'SEDIA') && !checkSaleHasIndent(s));
    } else if (statusFilter === 'COMPLETED') {
      list = list.filter(s => s?.status === 'SELESAI' || s?.status === 'COMPLETED');
    } else if (statusFilter === 'OVERDUE30') {
      list = list.filter(s => {
        if (!s) return false;
        const isDone = s.status === 'SELESAI' || s.status === 'COMPLETED' || s.status === 'CANCELLED' || s.status === 'BATAL';
        const { allItems } = getSaleItemsAndNd(s);
        const isReady = s.status === 'PROSES' || s.status === 'SEDIA' || allItems.some(i => i.status === 'SEDIA');
        const orderDate = new Date(s.updatedAt || s.createdAt || 0);
        return !isDone && isReady && orderDate <= thirtyDaysAgo;
      });
    }

    // Urutkan berdasarkan prioritas status lalu tanggal terbaru
    return list.sort((a, b) => {
      // Jika tab filter COMPLETED aktif, urutkan berdasarkan completedAt terbaru
      if (statusFilter === 'COMPLETED') {
        const timeA = new Date(a?.completedAt || a?.updatedAt || a?.createdAt || 0).getTime();
        const timeB = new Date(b?.completedAt || b?.updatedAt || b?.createdAt || 0).getTime();
        return timeB - timeA;
      }

      const pA = getStatusPriority(a);
      const pB = getStatusPriority(b);
      if (pA !== pB) return pA - pB;

      // Jika keduanya berstatus SELESAI / COMPLETED, urutkan berdasarkan waktu status berubah menjadi selesai
      if (pA === 4) {
        const timeA = new Date(a?.completedAt || a?.updatedAt || a?.createdAt || 0).getTime();
        const timeB = new Date(b?.completedAt || b?.updatedAt || b?.createdAt || 0).getTime();
        return timeB - timeA;
      }

      return new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0);
    });
  }, [sales, statusFilter]);

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const params = {};
      if (type && type !== 'ALL') params.type = type;
      if (search) params.search = search;
      if (statusFilter === 'OVERDUE30') {
        params.isOverdue30Days = 'true';
      } else if (['PENDING', 'PROSES', 'COMPLETED'].includes(statusFilter)) {
        params.status = statusFilter;
      }

      const res = await api.get('/uniforms/export-sales', {
        params,
        responseType: 'blob'
      });

      const blob = new Blob([res.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const filePrefix = type === 'SPMB' ? 'Laporan_Pesanan_SPMB' : (type === 'RETAIL' ? 'Laporan_Pesanan_Warid' : 'Laporan_Pesanan_Seragam');
      link.setAttribute('download', `${filePrefix}_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export Error:', err);
      alert('Gagal mengekspor data pesanan ke Excel. Silakan coba lagi.');
    } finally {
      setIsExporting(false);
    }
  };

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

        {/* Action Buttons: Public Form Link & Create Admin Order & Export Excel */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Tombol Ekspor Pesanan */}
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl text-xs font-bold transition shadow-sm shrink-0 cursor-pointer disabled:cursor-not-allowed"
            title="Ekspor Data Pesanan Seragam ke File Excel"
          >
            {isExporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            <span>{isExporting ? 'Mengekspor...' : 'Ekspor Excel'}</span>
          </button>

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

          {/* Tombol Tukar Ukuran */}
          <button
            type="button"
            onClick={() => openModal('exchange')}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold transition shadow-sm shrink-0"
            title="Tukar Ukuran Seragam (Retur / Ganti Ukuran)"
          >
            <RefreshCw size={13} className="text-amber-600" />
            <span>Tukar Ukuran</span>
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

        {counts.overdue30 > 0 && (
          <button
            onClick={() => setStatusFilter('OVERDUE30')}
            className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition animate-pulse ${
              statusFilter === 'OVERDUE30'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-rose-50 border border-rose-300 text-rose-800 hover:bg-rose-100'
            }`}
          >
            <AlertTriangle size={13} className="text-rose-600" />
            🚨 Siap Ambil &gt; 30 Hari ({counts.overdue30})
          </button>
        )}

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
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto custom-scrollbar">
        <table className="w-full text-sm min-w-[720px]">
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
              let ndTotal = 0;
              if (s.note && s.note.includes('[NAMADADA')) {
                const matches = [...s.note.matchAll(/\[(NAMADADA(?:_PUTIH|_COKLAT)?):(\d+):(\d+)(?::([A-Z_]+))?\]/g)];
                for (const m of matches) {
                  if (m[4] !== 'BATAL') {
                    ndTotal += (parseInt(m[2]) || 0) * (parseInt(m[3]) || 0);
                  }
                }
              }

              const { items: sItems, ndItems: sNdItems, allItems: sAllItems } = getSaleItemsAndNd(s);
              const activeSubtotal = (s.type === 'SPMB' || s.type === 'UNIT_ORDER')
                ? (Number(s.subtotal) || 0)
                : ((s.items?.filter(item => item.status !== 'BATAL').reduce((acc, item) => acc + (Number(item.totalPrice) || 0), 0) || 0) + ndTotal);
              const activeTotalAmount = Math.max(0, activeSubtotal - (Number(s.discount) || 0));
              const isExpanded = expandedSaleIds.has(s.id);
              const itemCount = sAllItems.length || 0;

              // Identifikasi item Indent & Sedia (termasuk Nama Dada)
              const indentItems = sAllItems.filter(i => i.status === 'INDENT' || i.status === 'TIDAK_TERSEDIA');
              const sediaItems = sAllItems.filter(i => i.status === 'SEDIA');
              const isCompleted = s.status === 'SELESAI' || s.status === 'COMPLETED';
              const orderDateObj = new Date(s.updatedAt || s.createdAt || 0);
              const diffDays = Math.floor((Date.now() - orderDateObj) / (1000 * 60 * 60 * 24));
              const isOverdue30 = (s.status === 'PROSES' || s.status === 'SEDIA' || sediaItems.length > 0) && !isCompleted && s.status !== 'BATAL' && s.status !== 'CANCELLED' && diffDays >= 30;

              return (
                <React.Fragment key={s.id}>
                  <tr className={`hover:bg-slate-50/80 transition-colors ${
                    isOverdue30
                      ? 'bg-rose-50/40 border-l-4 border-l-rose-500'
                      : isExpanded 
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
                      {isOverdue30 && (
                        <div className="text-[10px] font-black text-rose-700 bg-rose-100/90 border border-rose-200 px-1.5 py-0.5 rounded-md inline-flex items-center gap-1 mt-1">
                          🚨 Siap {diffDays} Hari
                        </div>
                      )}
                      {indentItems.length > 0 && !isCompleted && (
                        <div className="text-[10px] font-extrabold text-amber-700 flex items-center gap-1 mt-0.5" title={`Item Indent: ${indentItems.map(i => i.itemName + (i.size !== '-' ? ' (' + i.size + ')' : '')).join(', ')}`}>
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
                      {(Number(s.totalAmount) || 0) > activeTotalAmount ? (
                        <div className="flex flex-col items-end">
                          <span className="text-xs text-rose-400 line-through" title="Total Awal">Rp {(Number(s.totalAmount) || 0).toLocaleString('id-ID')}</span>
                          <span className="font-bold text-slate-800" title="Total Setelah Batal">Rp {activeTotalAmount.toLocaleString('id-ID')}</span>
                        </div>
                      ) : (
                        <span className="font-bold text-slate-800">Rp {activeTotalAmount.toLocaleString('id-ID')}</span>
                      )}
                    </td>

                    {/* Status Bayar */}
                    <td className="p-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <Badge color={s.paymentStatus === 'PAID' ? 'green' : s.paymentStatus === 'PARTIAL' ? 'orange' : 'red'}>
                          {s.paymentStatus === 'PAID' ? 'LUNAS' : s.paymentStatus === 'PARTIAL' ? 'PARSIAL' : 'BELUM BAYAR'}
                        </Badge>

                        {s.paymentStatus === 'PARTIAL' && (
                          <div className="w-full max-w-[125px] space-y-0.5 mt-0.5">
                            <div className="flex justify-between text-[10px] font-bold text-slate-500">
                              <span>Terbayar:</span>
                              <span className="text-emerald-700">Rp {(Number(s.paidAmount) || 0).toLocaleString('id-ID')}</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className="bg-amber-500 h-full rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(100, Math.max(0, ((Number(s.paidAmount) || 0) / (activeTotalAmount || 1)) * 100))}%` }}
                              />
                            </div>
                            <div className="text-[10px] text-rose-600 font-bold text-right">
                              Sisa: Rp {Math.max(0, activeTotalAmount - (Number(s.paidAmount) || 0)).toLocaleString('id-ID')}
                            </div>
                          </div>
                        )}

                        {s.paymentStatus === 'PAID' && (
                          <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                            Rp {(Number(s.paidAmount) || activeTotalAmount).toLocaleString('id-ID')}
                          </div>
                        )}

                        {onUpdatePayment && (
                          <button 
                            type="button"
                            onClick={() => setPaymentModal({ open: true, sale: s })}
                            className="mt-1 flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer shadow-xs"
                            title="Kelola Pembayaran (Lunas, Parsial / DP, Cicil)"
                          >
                            <CreditCard size={11} />
                            <span>Kelola Bayar</span>
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Status & Kelola Item Toggle */}
                    <td className="p-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <Badge color={
                          isCompleted ? 'green' : 
                          s.status === 'PROSES' || s.status === 'SEDIA' ? 'blue' : 
                          s.status === 'PENDING' ? 'yellow' : 'slate'
                        }>
                          {isCompleted ? 'SELESAI' : s.status}
                        </Badge>

                        {/* Completed At Timestamp */}
                        {isCompleted && (s.completedAt || s.updatedAt) && (
                          <div className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1 mt-0.5" title="Waktu pesanan berstatus selesai">
                            <CheckCheck size={11} className="text-emerald-600" />
                            <span>
                              {new Date(s.completedAt || s.updatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}{' '}
                              {new Date(s.completedAt || s.updatedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )}

                        {/* Indent Indicator Badge if any items are INDENT */}
                        {indentItems.length > 0 && !isCompleted && (
                          <span 
                            className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full shadow-sm"
                            title={`Item Indent: ${indentItems.map(i => i.itemName + (i.size !== '-' ? ' (' + i.size + ')' : '')).join(', ')}`}
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

                        {/* Diambil count badge */}
                        {!isCompleted && sAllItems.filter(i => i.status === 'DIAMBIL').length > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                            📦 {sAllItems.filter(i => i.status === 'DIAMBIL').length} Diambil
                          </span>
                        )}
                      </div>

                      {canFulfill && s.status !== 'CANCELLED' && (
                        <button 
                          onClick={() => toggleExpand(s.id)} 
                          className={`mt-1.5 text-xs font-bold px-2.5 py-1 rounded-xl transition-all flex items-center justify-center gap-1 mx-auto whitespace-nowrap cursor-pointer ${
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
                      {(() => {
                        if (!s.note || !s.note.includes('[DEADLINE:')) return null;
                        const match = s.note.match(/\[DEADLINE:(.*?)\]/);
                        if (!match || !match[1]) return null;
                        const dlStr = match[1].trim();
                        const dlDate = /^\d{4}-\d{2}-\d{2}$/.test(dlStr) ? new Date(dlStr + 'T23:59:59') : new Date(dlStr);
                        const isOverdue = dlDate && (new Date() > dlDate) && s.paymentStatus !== 'PAID';
                        const formatted = dlDate && !isNaN(dlDate.getTime()) 
                          ? dlDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
                          : dlStr;
                        return (
                          <div className={`text-[9px] font-bold mb-1 px-1.5 py-0.5 rounded-md inline-block ${
                            isOverdue 
                              ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}>
                            {isOverdue ? '⚠️ Lewat:' : '⏳ Batas:'} {formatted}
                          </div>
                        );
                      })()}
                      <div className="flex flex-wrap items-center justify-center gap-1">
                        <a 
                          href={`/public/invoice-seragam/${s.id}`} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-[10px] font-bold text-blue-600 hover:underline inline-flex items-center gap-0.5 bg-blue-50 px-2 py-0.5 rounded-lg"
                        >
                          Invoice <ExternalLink size={10} />
                        </a>
                        {s.type === 'SPMB' && (
                          <button
                            type="button"
                            onClick={async () => {
                              let phone = s.customerPhone;
                              if (!phone) {
                                phone = prompt('Nomor WhatsApp belum tersedia. Masukkan Nomor WA Pemesan:');
                                if (!phone) return;
                              }
                              const existingDl = s.note?.match(/\[DEADLINE:(.*?)\]/)?.[1] || new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0];
                              const deadline = prompt('Masukkan Batas Tanggal Pembayaran (YYYY-MM-DD):', existingDl);
                              if (deadline === null) return;
                              try {
                                const res = await api.post(`/uniforms/sales/${s.id}/send-billing-wa`, { phone, deadline });
                                alert(res.data.message || 'Tagihan WhatsApp berhasil dikirim ke pemesan!');
                                if (onRefresh) onRefresh();
                              } catch (err) {
                                alert(err.response?.data?.error || 'Gagal mengirimkan tagihan WhatsApp');
                              }
                            }}
                            className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-lg inline-flex items-center gap-1"
                            title="Kirimkan Tagihan / Pengingat Resmi ke WhatsApp Pemesan"
                          >
                            <Send size={10} /> WA Tagihan
                          </button>
                        )}
                        {openModal && (
                          <button 
                            type="button"
                            onClick={() => openModal('exchange', s)} 
                            className="text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-lg inline-flex items-center gap-1" 
                            title="Tukar Ukuran untuk Pesanan Ini"
                          >
                            <RefreshCw size={10} /> Tukar
                          </button>
                        )}
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
                          variants={variants}
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
                          Harga: Rp {(Number(pkg.price) || 0).toLocaleString('id-ID')}
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

      {/* Modal Kelola Pembayaran Tagihan (Parsial / Lunas) */}
      <PaymentManagementModal 
        sale={paymentModal.sale} 
        isOpen={paymentModal.open} 
        onClose={() => setPaymentModal({ open: false, sale: null })} 
        onSave={onUpdatePayment} 
      />
    </div>
  );
};


