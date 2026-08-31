import React, { useState, useEffect, useMemo } from 'react';
import { 
  RefreshCw, Plus, Trash2, Search, Check, AlertCircle, 
  ArrowRight, DollarSign, CreditCard, Building, Package, User, FileText,
  CheckCircle2, Clock, Sparkles, MapPin
} from 'lucide-react';
import { Badge } from './UIComponents';

const InputField = ({ label, ...props }) => (
    <div className="space-y-1.5">
        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">{label}</label>
        <input className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition" {...props} />
    </div>
);

const SelectField = ({ label, children, ...props }) => (
    <div className="space-y-1.5">
        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">{label}</label>
        <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition" {...props}>
            {children}
        </select>
    </div>
);

export const ExchangeForm = ({ 
  warehouses = [], 
  variants = [], 
  sales = [], 
  initialSale = null, 
  onSave 
}) => {
    const [mode, setMode] = useState('INVOICE'); // 'INVOICE' | 'MANUAL'
    const [selectedSale, setSelectedSale] = useState(initialSale || null);
    const [searchInvoice, setSearchInvoice] = useState(initialSale?.code || '');
    const [showSaleDropdown, setShowSaleDropdown] = useState(false);

    // Form states
    const [studentName, setStudentName] = useState(initialSale?.studentName || '');
    const [customerName, setCustomerName] = useState(initialSale?.customerName || '');
    const [reason, setReason] = useState('SIZE_MISMATCH');
    const [note, setNote] = useState('');
    
    // Financial difference states
    const [isPaidDiff, setIsPaidDiff] = useState(true);
    const [paymentMethod, setPaymentMethod] = useState('CASH');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Array of exchange rows
    const [exchanges, setExchanges] = useState([]);

    const defaultWhId = warehouses[0]?.id ? String(warehouses[0].id) : '';

    // Initialize or sync with selected sale
    useEffect(() => {
        if (selectedSale) {
            setStudentName(selectedSale.studentName || '');
            setCustomerName(selectedSale.customerName || '');

            // Pre-populate with items from the sale (allowing DIAMBIL, SEDIA, INDENT, PENDING)
            if (selectedSale.items && selectedSale.items.length > 0) {
                const initialExchanges = selectedSale.items
                    .filter(item => item.status !== 'BATAL')
                    .map(item => ({
                        selected: false, // user chooses which item to exchange
                        saleItemId: item.id,
                        fromVariantId: String(item.variantId || ''),
                        itemName: item.itemName,
                        oldSize: item.size,
                        oldUnitPrice: item.unitPrice || 0,
                        toVariantId: '',
                        qty: item.qty || 1,
                        status: item.status || 'PENDING',
                        newStatus: item.status === 'DIAMBIL' ? 'DIAMBIL' : (item.status === 'SEDIA' ? 'SEDIA' : 'SEDIA'),
                        fromWarehouseId: defaultWhId,
                        toWarehouseId: defaultWhId,
                        transitWarehouseId: defaultWhId
                    }));
                setExchanges(initialExchanges);
            }
        } else if (mode === 'MANUAL') {
            setExchanges([{ 
                fromVariantId: '', 
                toVariantId: '', 
                qty: 1, 
                status: 'DIAMBIL',
                newStatus: 'DIAMBIL',
                fromWarehouseId: defaultWhId, 
                toWarehouseId: defaultWhId,
                transitWarehouseId: defaultWhId,
                oldUnitPrice: 0
            }]);
        }
    }, [selectedSale, mode, defaultWhId]);

    // Filter sales for autocomplete search
    const filteredSales = useMemo(() => {
        if (!searchInvoice.trim()) return sales.slice(0, 8);
        const q = searchInvoice.toLowerCase();
        return sales.filter(s => 
            s.code?.toLowerCase().includes(q) ||
            s.studentName?.toLowerCase().includes(q) ||
            s.customerName?.toLowerCase().includes(q)
        ).slice(0, 10);
    }, [sales, searchInvoice]);

    const handleSelectSale = (sale) => {
        setSelectedSale(sale);
        setSearchInvoice(sale.code);
        setShowSaleDropdown(false);
    };

    const handleClearSale = () => {
        setSelectedSale(null);
        setSearchInvoice('');
        setExchanges([]);
    };

    const updateExchangeRow = (index, field, value) => {
        setExchanges(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            if (field === 'fromVariantId' && mode === 'MANUAL') {
                next[index].toVariantId = ''; // reset target variant
                const v = variants.find(v => String(v.id) === String(value));
                next[index].oldUnitPrice = v?.sellPrice || v?.item?.basePrice || 0;
            }
            // If toWarehouseId changes and transitWarehouseId was same as previous toWarehouseId, sync it
            if (field === 'toWarehouseId' && (!next[index].transitWarehouseId || next[index].transitWarehouseId === next[index].toWarehouseId)) {
                next[index].transitWarehouseId = value;
            }
            return next;
        });
    };

    const addManualExchangeRow = () => {
        setExchanges(prev => [
            ...prev,
            { 
                fromVariantId: '', 
                toVariantId: '', 
                qty: 1, 
                status: 'DIAMBIL',
                newStatus: 'DIAMBIL',
                fromWarehouseId: defaultWhId, 
                toWarehouseId: defaultWhId,
                transitWarehouseId: defaultWhId,
                oldUnitPrice: 0
            }
        ]);
    };

    const removeManualExchangeRow = (index) => {
        setExchanges(prev => prev.filter((_, i) => i !== index));
    };

    // Calculate total price differences
    const financialSummary = useMemo(() => {
        const activeExchanges = mode === 'INVOICE' 
            ? exchanges.filter(e => e.selected && e.fromVariantId && e.toVariantId)
            : exchanges.filter(e => e.fromVariantId && e.toVariantId);

        let totalOldPrice = 0;
        let totalNewPrice = 0;

        activeExchanges.forEach(e => {
            const fromV = variants.find(v => String(v.id) === String(e.fromVariantId));
            const toV = variants.find(v => String(v.id) === String(e.toVariantId));

            const oldPrice = e.oldUnitPrice !== undefined ? e.oldUnitPrice : (fromV?.sellPrice || fromV?.item?.basePrice || 0);
            const newPrice = toV?.sellPrice || toV?.item?.basePrice || 0;
            const qty = e.qty || 1;

            totalOldPrice += oldPrice * qty;
            totalNewPrice += newPrice * qty;
        });

        const priceDiff = totalNewPrice - totalOldPrice;
        return {
            activeCount: activeExchanges.length,
            totalOldPrice,
            totalNewPrice,
            priceDiff
        };
    }, [exchanges, mode, variants]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const activeItems = mode === 'INVOICE'
            ? exchanges.filter(e => e.selected)
            : exchanges;

        if (activeItems.length === 0) {
            alert('Pilih setidaknya 1 item yang ingin ditukar');
            return;
        }

        for (const item of activeItems) {
            if (!item.fromVariantId) {
                alert('Pilih varian seragam yang dikembalikan');
                return;
            }
            if (!item.toVariantId) {
                alert('Pilih ukuran baru pengganti');
                return;
            }
            if (!item.fromWarehouseId) {
                alert('Pilih gudang tempat barang lama dikembalikan (1. Gudang Pengembalian)');
                return;
            }
            if (!item.toWarehouseId) {
                alert('Pilih gudang tempat barang baru diambil (2. Gudang Sumber)');
                return;
            }
        }

        const payload = {
            saleId: selectedSale ? selectedSale.id : null,
            studentName: studentName || selectedSale?.studentName || '',
            customerName: customerName || selectedSale?.customerName || '',
            reason,
            note,
            isPaidDiff,
            paymentMethod: isPaidDiff ? paymentMethod : null,
            exchanges: activeItems.map(item => {
                const toV = variants.find(v => String(v.id) === String(item.toVariantId));
                return {
                    saleItemId: item.saleItemId || null,
                    fromVariantId: item.fromVariantId,
                    toVariantId: item.toVariantId,
                    oldUnitPrice: item.oldUnitPrice,
                    newUnitPrice: toV?.sellPrice || toV?.item?.basePrice || 0,
                    qty: item.qty || 1,
                    newStatus: item.newStatus || item.status,
                    fromWarehouseId: item.fromWarehouseId,
                    toWarehouseId: item.toWarehouseId,
                    transitWarehouseId: item.transitWarehouseId || item.toWarehouseId
                };
            })
        };

        setIsSubmitting(true);
        try {
            await onSave(payload);
        } catch (err) {
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5 animate-in fade-in duration-200">
            
            {/* Mode Switcher */}
            <div className="flex items-center justify-between p-1 bg-slate-100 rounded-xl">
                <button
                    type="button"
                    onClick={() => { setMode('INVOICE'); }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
                        mode === 'INVOICE' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                    📑 Berdasarkan Pesanan / Invoice
                </button>
                <button
                    type="button"
                    onClick={() => { setMode('MANUAL'); handleClearSale(); }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
                        mode === 'MANUAL' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                    ✍️ Penukaran Bebas (Tanpa Invoice)
                </button>
            </div>

            {/* Mode 1: Search and Select Invoice */}
            {mode === 'INVOICE' && (
                <div className="space-y-3">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Cari Invoice / Nama Pemesan / Siswa *
                    </label>

                    {!selectedSale ? (
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="text"
                                placeholder="Ketik nomor invoice (INV/SRG/...) atau nama siswa..."
                                value={searchInvoice}
                                onChange={(e) => { setSearchInvoice(e.target.value); setShowSaleDropdown(true); }}
                                onFocus={() => setShowSaleDropdown(true)}
                                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />

                            {showSaleDropdown && filteredSales.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-100 max-h-56 overflow-y-auto z-50 divide-y divide-slate-100">
                                    {filteredSales.map(s => (
                                        <div
                                            key={s.id}
                                            onClick={() => handleSelectSale(s)}
                                            className="p-3 hover:bg-blue-50 cursor-pointer flex justify-between items-center transition"
                                        >
                                            <div>
                                                <div className="font-bold text-xs text-blue-700 font-mono">{s.code}</div>
                                                <div className="text-xs font-semibold text-slate-800">{s.customerName} {s.studentName ? `• Siswa: ${s.studentName}` : ''}</div>
                                                <div className="text-[10px] text-slate-400">Unit: {s.targetUnit || '-'} • Status: {s.status}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs font-bold text-slate-700">Rp {s.totalAmount?.toLocaleString('id-ID')}</div>
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                                    s.paymentStatus === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                                }`}>
                                                    {s.paymentStatus}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl flex justify-between items-center">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-black text-blue-700 text-sm font-mono">{selectedSale.code}</span>
                                    <span className="text-xs font-bold bg-white text-blue-800 border border-blue-300 px-2 py-0.5 rounded-full">
                                        {selectedSale.type}
                                    </span>
                                </div>
                                <div className="text-xs text-slate-700 font-semibold mt-0.5">
                                    Wali/Pemesan: <strong>{selectedSale.customerName}</strong> {selectedSale.studentName && `• Siswa: ${selectedSale.studentName}`}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                    Unit: {selectedSale.targetUnit || '-'} • Status Tagihan: <strong className={selectedSale.paymentStatus === 'PAID' ? 'text-green-700' : 'text-amber-700'}>{selectedSale.paymentStatus}</strong>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleClearSale}
                                className="text-xs font-bold text-red-600 hover:text-red-800 bg-white hover:bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg transition"
                            >
                                Ganti Invoice
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Customer & Student Name if Manual */}
            {mode === 'MANUAL' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <InputField 
                        label="Nama Siswa *" 
                        value={studentName} 
                        onChange={e => setStudentName(e.target.value)} 
                        placeholder="Contoh: Ahmad Fauzan" 
                        required 
                    />
                    <InputField 
                        label="Nama Wali / Pemesan" 
                        value={customerName} 
                        onChange={e => setCustomerName(e.target.value)} 
                        placeholder="Contoh: Bpk. Kurnia" 
                    />
                </div>
            )}

            {/* List of Exchange Items */}
            <div className="space-y-3">
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <RefreshCw size={14} className="text-blue-600" /> 
                            {mode === 'INVOICE' ? 'Pilih Item Pesanan yang Ingin Ditukar:' : 'Daftar Barang yang Ditukar:'}
                        </h3>
                    </div>

                    {mode === 'MANUAL' && (
                        <button
                            type="button"
                            onClick={addManualExchangeRow}
                            className="text-xs flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1 rounded-lg font-bold hover:bg-blue-200 transition"
                        >
                            <Plus size={13} /> Tambah Item
                        </button>
                    )}
                </div>

                {/* Items Container */}
                <div className="space-y-4 max-h-[52vh] overflow-y-auto pr-1">
                    {mode === 'INVOICE' && (!selectedSale || exchanges.length === 0) ? (
                        <div className="p-6 text-center text-xs text-slate-400 border border-dashed rounded-xl bg-slate-50/50">
                            Silakan cari dan pilih nomor invoice di atas untuk memuat daftar seragam yang dipesan.
                        </div>
                    ) : exchanges.map((exc, index) => {
                        // Find available size variants for the same uniform item
                        const fromV = variants.find(v => String(v.id) === String(exc.fromVariantId));
                        const availableToVariants = fromV 
                            ? variants.filter(v => String(v.itemId) === String(fromV.itemId) && String(v.id) !== String(exc.fromVariantId))
                            : variants;

                        const selectedToV = variants.find(v => String(v.id) === String(exc.toVariantId));
                        
                        // Sisa stok di gudang keluar yang dipilih
                        const stockInToWh = selectedToV?.stocks?.find(s => String(s.warehouseId) === String(exc.toWarehouseId))?.quantity || 0;
                        const hasStock = stockInToWh >= (exc.qty || 1);

                        // Selisih harga item ini
                        const oldPrice = exc.oldUnitPrice || fromV?.sellPrice || fromV?.item?.basePrice || 0;
                        const newPrice = selectedToV ? (selectedToV.sellPrice || selectedToV.item?.basePrice || 0) : oldPrice;
                        const itemPriceDiff = (newPrice - oldPrice) * (exc.qty || 1);

                        const isReady = exc.status === 'SEDIA';
                        const isTaken = exc.status === 'DIAMBIL' || exc.status === 'DELIVERED';
                        const isIndent = exc.status === 'INDENT' || exc.status === 'TIDAK_TERSEDIA';

                        return (
                            <div 
                                key={index} 
                                className={`p-4 rounded-2xl border transition-all ${
                                    mode === 'INVOICE' && !exc.selected 
                                        ? 'bg-slate-50/60 border-slate-200 opacity-70' 
                                        : 'bg-white border-blue-300 shadow-md ring-1 ring-blue-500/20'
                                }`}
                            >
                                <div className="flex items-start gap-3">
                                    {mode === 'INVOICE' && (
                                        <div className="pt-1">
                                            <input
                                                type="checkbox"
                                                checked={exc.selected}
                                                onChange={(e) => updateExchangeRow(index, 'selected', e.target.checked)}
                                                className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                                            />
                                        </div>
                                    )}

                                    <div className="flex-1 space-y-3.5">
                                        {/* Row Header Info */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                            <div>
                                                <div className="font-bold text-sm text-slate-800 flex items-center gap-2">
                                                    <span>{exc.itemName || fromV?.item?.name || 'Pilih Seragam'}</span>
                                                    
                                                    {/* Status Badge */}
                                                    {mode === 'INVOICE' && (
                                                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                                            isTaken ? 'bg-blue-100 text-blue-800' :
                                                            isReady ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                                                            isIndent ? 'bg-amber-100 text-amber-800' :
                                                            'bg-slate-100 text-slate-700'
                                                        }`}>
                                                            {isTaken ? '✓ Sudah Diambil' :
                                                             isReady ? '📦 Sedia (Belum Diambil / Fitting)' :
                                                             isIndent ? '⏳ Indent' : exc.status}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                                                    <span>Ukuran Lama: <strong className="text-slate-800">{exc.oldSize || fromV?.sizeName || '-'}</strong></span>
                                                    <span>•</span>
                                                    <span>Harga Beli: <strong className="text-slate-800">Rp {oldPrice.toLocaleString('id-ID')}</strong></span>
                                                    <span>•</span>
                                                    <span>Jumlah: <strong className="text-slate-800">{exc.qty} pcs</strong></span>
                                                </div>
                                            </div>

                                            {mode === 'MANUAL' && exchanges.length > 1 && (
                                                <button 
                                                    type="button" 
                                                    onClick={() => removeManualExchangeRow(index)}
                                                    className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>

                                        {/* Dropdown Options if active */}
                                        {(mode === 'MANUAL' || exc.selected) && (
                                            <div className="space-y-3 pt-3 border-t border-slate-100">
                                                
                                                {/* 1. Pilih Ukuran Pengganti Baru */}
                                                <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-200">
                                                    <label className="block text-xs font-bold text-blue-800 mb-1">
                                                        Pilih Ukuran Baru Pengganti *
                                                    </label>
                                                    <select
                                                        value={exc.toVariantId}
                                                        onChange={(e) => updateExchangeRow(index, 'toVariantId', e.target.value)}
                                                        required
                                                        className="w-full bg-white border border-blue-300 rounded-xl p-2.5 text-xs sm:text-sm font-bold text-slate-800 outline-none shadow-xs"
                                                    >
                                                        <option value="">-- Pilih Ukuran Baru --</option>
                                                        {availableToVariants.map(v => {
                                                            const p = v.sellPrice || v.item?.basePrice || 0;
                                                            const diff = p - oldPrice;
                                                            const diffText = diff > 0 ? ` (+Rp ${diff.toLocaleString('id-ID')})` : diff < 0 ? ` (-Rp ${Math.abs(diff).toLocaleString('id-ID')})` : ' (Harga Sama)';
                                                            return (
                                                                <option key={v.id} value={v.id}>
                                                                    Ukuran {v.sizeName} - Rp {p.toLocaleString('id-ID')}{diffText}
                                                                </option>
                                                            );
                                                        })}
                                                    </select>

                                                    {selectedToV && (
                                                        <div className="mt-2 flex flex-wrap items-center justify-between text-xs pt-1 border-t border-blue-200/60">
                                                            <span className={hasStock ? 'text-emerald-700 font-bold' : 'text-rose-600 font-bold'}>
                                                                Sisa Stok Ukuran {selectedToV.sizeName}: <strong>{stockInToWh} pcs</strong> {hasStock ? '✓ Tersedia' : '⚠️ Kosong/Indent'}
                                                            </span>
                                                            <span className="font-extrabold text-slate-700">
                                                                Selisih Biaya: <strong className={itemPriceDiff > 0 ? 'text-amber-700' : itemPriceDiff < 0 ? 'text-emerald-700' : 'text-slate-800'}>
                                                                    {itemPriceDiff > 0 ? `+Rp ${itemPriceDiff.toLocaleString('id-ID')} (Tambah)` : itemPriceDiff < 0 ? `-Rp ${Math.abs(itemPriceDiff).toLocaleString('id-ID')} (Kembalian)` : 'Rp 0 (Pas)'}
                                                                </strong>
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* 2. Tiga Pilihan Gudang Jelas Per-Item */}
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                                                    
                                                    {/* Pilihan 1: Gudang Masuk (Barang Lama) */}
                                                    <div className="space-y-1">
                                                        <label className="block text-[11px] font-bold text-slate-700 flex items-center gap-1">
                                                            <Building size={13} className="text-amber-600" />
                                                            1. Barang Lama Dikembalikan Ke:
                                                        </label>
                                                        <select
                                                            value={exc.fromWarehouseId}
                                                            onChange={(e) => updateExchangeRow(index, 'fromWarehouseId', e.target.value)}
                                                            className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800 outline-none"
                                                        >
                                                            {warehouses.map(w => (
                                                                <option key={w.id} value={w.id}>{w.name}</option>
                                                            ))}
                                                        </select>
                                                        <p className="text-[10px] text-slate-400">Stok ukuran lama masuk ke sini</p>
                                                    </div>

                                                    {/* Pilihan 2: Gudang Keluar (Barang Baru) */}
                                                    <div className="space-y-1">
                                                        <label className="block text-[11px] font-bold text-slate-700 flex items-center gap-1">
                                                            <Package size={13} className="text-blue-600" />
                                                            2. Barang Baru Diambil Dari:
                                                        </label>
                                                        <select
                                                            value={exc.toWarehouseId}
                                                            onChange={(e) => updateExchangeRow(index, 'toWarehouseId', e.target.value)}
                                                            className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800 outline-none"
                                                        >
                                                            {warehouses.map(w => {
                                                                const st = selectedToV?.stocks?.find(s => s.warehouseId === w.id);
                                                                return (
                                                                    <option key={w.id} value={w.id}>
                                                                        {w.name} {selectedToV ? `(${st?.quantity || 0} pcs)` : ''}
                                                                    </option>
                                                                );
                                                            })}
                                                        </select>
                                                        <p className="text-[10px] text-slate-400">Stok ukuran baru keluar dari sini</p>
                                                    </div>

                                                    {/* Pilihan 3: Gudang Penjemputan / Lokasi Serah Terima */}
                                                    <div className="space-y-1">
                                                        <label className="block text-[11px] font-bold text-slate-700 flex items-center gap-1">
                                                            <MapPin size={13} className="text-emerald-600" />
                                                            3. Barang Baru Dijemput di Gudang:
                                                        </label>
                                                        <select
                                                            value={exc.transitWarehouseId || exc.toWarehouseId}
                                                            onChange={(e) => updateExchangeRow(index, 'transitWarehouseId', e.target.value)}
                                                            className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800 outline-none"
                                                        >
                                                            {warehouses.map(w => (
                                                                <option key={w.id} value={w.id}>{w.name}</option>
                                                            ))}
                                                        </select>
                                                        <p className="text-[10px] text-slate-400">Lokasi siswa menjemput seragam</p>
                                                    </div>

                                                </div>

                                                {/* Pilihan Status Penyerahan jika barang belum diambil (SEDIA / INDENT) */}
                                                {mode === 'INVOICE' && (isReady || isIndent) && (
                                                    <div className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                        <span className="text-xs font-bold text-emerald-900">
                                                            Status Seragam Baru Setelah Ditukar:
                                                        </span>
                                                        <div className="flex items-center gap-3 text-xs">
                                                            <label className="flex items-center gap-1.5 cursor-pointer font-bold text-emerald-800 bg-white px-2.5 py-1 rounded-lg border border-emerald-300 shadow-xs">
                                                                <input
                                                                    type="radio"
                                                                    name={`newStatus_${index}`}
                                                                    checked={exc.newStatus === 'SEDIA'}
                                                                    onChange={() => updateExchangeRow(index, 'newStatus', 'SEDIA')}
                                                                    className="text-emerald-600"
                                                                />
                                                                📦 Tetap Sedia (Disimpan untuk dijemput nanti)
                                                            </label>
                                                            <label className="flex items-center gap-1.5 cursor-pointer font-bold text-blue-800 bg-white px-2.5 py-1 rounded-lg border border-blue-300 shadow-xs">
                                                                <input
                                                                    type="radio"
                                                                    name={`newStatus_${index}`}
                                                                    checked={exc.newStatus === 'DIAMBIL'}
                                                                    onChange={() => updateExchangeRow(index, 'newStatus', 'DIAMBIL')}
                                                                    className="text-blue-600"
                                                                    />
                                                                ✓ Langsung Diserahkan Sekarang
                                                            </label>
                                                        </div>
                                                    </div>
                                                )}

                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Financial Price Difference & Settlement Card */}
            {financialSummary.activeCount > 0 && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <DollarSign size={16} className="text-blue-700" />
                            <span className="font-bold text-xs text-slate-800">Rekapitulasi Keuangan Penukaran</span>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-slate-500">Selisih Biaya:</div>
                            <div className={`text-sm font-extrabold ${
                                financialSummary.priceDiff > 0 ? 'text-amber-700' : 
                                financialSummary.priceDiff < 0 ? 'text-emerald-700' : 'text-slate-700'
                            }`}>
                                {financialSummary.priceDiff > 0 ? `+Rp ${financialSummary.priceDiff.toLocaleString('id-ID')} (Kurang Bayar)` :
                                 financialSummary.priceDiff < 0 ? `-Rp ${Math.abs(financialSummary.priceDiff).toLocaleString('id-ID')} (Kembalian)` :
                                 'Rp 0 (Harga Sama)'}
                            </div>
                        </div>
                    </div>

                    {/* Options for Price Difference > 0 */}
                    {financialSummary.priceDiff > 0 && (
                        <div className="pt-2 border-t border-blue-200/80 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                    Pembayaran Selisih:
                                </label>
                                <div className="flex items-center gap-3">
                                    <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-800">
                                        <input
                                            type="radio"
                                            name="isPaidDiff"
                                            checked={isPaidDiff === true}
                                            onChange={() => setIsPaidDiff(true)}
                                            className="text-blue-600"
                                        />
                                        Bayar Sekarang (Lunas)
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-600">
                                        <input
                                            type="radio"
                                            name="isPaidDiff"
                                            checked={isPaidDiff === false}
                                            onChange={() => setIsPaidDiff(false)}
                                            className="text-blue-600"
                                        />
                                        Tagihkan ke Invoice
                                    </label>
                                </div>
                            </div>

                            {isPaidDiff && (
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                        Metode Pembayaran Selisih:
                                    </label>
                                    <select
                                        value={paymentMethod}
                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-bold text-slate-800 outline-none"
                                    >
                                        <option value="CASH">Kas Tunai (Cash)</option>
                                        <option value="TRANSFER">Transfer Bank</option>
                                        <option value="QRIS">QRIS</option>
                                    </select>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Notice for Price Difference < 0 */}
                    {financialSummary.priceDiff < 0 && (
                        <div className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 p-2 rounded-lg font-semibold flex items-center gap-1.5">
                            <span>💵</span>
                            <span>Dana sebesar <strong>Rp {Math.abs(financialSummary.priceDiff).toLocaleString('id-ID')}</strong> dikembalikan ke wali murid. Tagihan invoice otomatis berkurang.</span>
                        </div>
                    )}
                </div>
            )}

            {/* Reason & Note */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <SelectField label="Alasan Penukaran *" value={reason} onChange={e => setReason(e.target.value)} required>
                    <option value="SIZE_MISMATCH">Ukuran Tidak Pas / Dicoba Kekecilan / Kebesaran</option>
                    <option value="DEFECTIVE">Barang Cacat / Rusak</option>
                    <option value="WRONG_ITEM">Salah Varian / Barang</option>
                    <option value="OTHER">Alasan Lainnya</option>
                </SelectField>
                <InputField 
                    label="Catatan Tambahan (Opsional)" 
                    value={note} 
                    onChange={e => setNote(e.target.value)} 
                    placeholder="Contoh: Ditukar saat fitting di sekolah sebelum dibawa pulang..." 
                />
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button 
                    type="submit" 
                    disabled={isSubmitting || financialSummary.activeCount === 0}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-7 py-2.5 rounded-xl font-bold transition flex items-center gap-2 shadow-lg shadow-blue-500/20 text-xs sm:text-sm disabled:opacity-50"
                >
                    <RefreshCw size={15} />
                    {isSubmitting ? 'Memproses Penukaran...' : 'Konfirmasi & Proses Penukaran'}
                </button>
            </div>
        </form>
    );
};
