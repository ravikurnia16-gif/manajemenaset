import React, { useState, useMemo } from 'react';
import { 
    Printer, 
    Search, 
    Filter, 
    CheckSquare, 
    Square, 
    Send, 
    CreditCard, 
    ExternalLink, 
    FileText, 
    CheckCircle, 
    XCircle, 
    Clock, 
    AlertTriangle, 
    RefreshCw, 
    Loader2, 
    Sparkles, 
    CheckCheck,
    X,
    MessageSquare
} from 'lucide-react';
import api from '../../lib/axios';

export const BatchInvoiceTab = ({ 
    sales = [], 
    units = [], 
    loading = false, 
    onRefresh,
    onUpdatePayment
}) => {
    // Filter states
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL' | 'SPMB' | 'RETAIL'
    const [unitFilter, setUnitFilter] = useState('ALL');
    const [paymentFilter, setPaymentFilter] = useState('ALL'); // 'ALL' | 'UNPAID' | 'PARTIAL' | 'PAID'
    const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'SEDIA' | 'DIAMBIL' | 'INDENT' | 'PENDING'

    // Selection states
    const [selectedIds, setSelectedIds] = useState(new Set());

    // WhatsApp Broadcast Modal State
    const [waModal, setWaModal] = useState({ open: false, singleSale: null, isBatch: false });
    const [waDeadline, setWaDeadline] = useState('');
    const [waCustomNote, setWaCustomNote] = useState('');
    const [isSendingWA, setIsSendingWA] = useState(false);
    const [waResult, setWaResult] = useState(null);

    // Filtered sales
    const filteredSales = useMemo(() => {
        return sales.filter(s => {
            // Type filter
            if (typeFilter === 'SPMB' && s.type !== 'SPMB') return false;
            if (typeFilter === 'RETAIL' && s.type === 'SPMB') return false;

            // Unit filter
            if (unitFilter !== 'ALL' && s.targetUnit !== unitFilter) return false;

            // Payment filter
            if (paymentFilter === 'PAID' && s.paymentStatus !== 'PAID') return false;
            if (paymentFilter === 'UNPAID' && (s.paymentStatus === 'PAID' || s.paymentStatus === 'PARTIAL')) return false;
            if (paymentFilter === 'PARTIAL' && s.paymentStatus !== 'PARTIAL') return false;

            // Status filter
            if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;

            // Search query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const code = (s.code || '').toLowerCase();
                const name = (s.customerName || s.studentName || '').toLowerCase();
                const phone = (s.customerPhone || '').toLowerCase();
                const unit = (s.targetUnit || '').toLowerCase();
                return code.includes(q) || name.includes(q) || phone.includes(q) || unit.includes(q);
            }

            return true;
        });
    }, [sales, typeFilter, unitFilter, paymentFilter, statusFilter, searchQuery]);

    // Selection Helpers
    const handleToggleSelect = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSelectAllFiltered = () => {
        if (selectedIds.size === filteredSales.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredSales.map(s => s.id)));
        }
    };

    const handleSelectUnpaid = () => {
        const unpaids = filteredSales.filter(s => s.paymentStatus !== 'PAID');
        setSelectedIds(new Set(unpaids.map(s => s.id)));
    };

    const handleSelectReady = () => {
        const ready = filteredSales.filter(s => s.status === 'SEDIA');
        setSelectedIds(new Set(ready.map(s => s.id)));
    };

    // Calculate selection totals
    const selectedSales = useMemo(() => {
        return sales.filter(s => selectedIds.has(s.id));
    }, [sales, selectedIds]);

    const totalSelectedAmount = useMemo(() => {
        return selectedSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    }, [selectedSales]);

    const totalSelectedRemaining = useMemo(() => {
        return selectedSales.reduce((sum, s) => sum + Math.max(0, (s.totalAmount || 0) - (s.paidAmount || 0)), 0);
    }, [selectedSales]);

    const spmbSelectedSales = useMemo(() => {
        return selectedSales.filter(s => s.type === 'SPMB');
    }, [selectedSales]);

    // Trigger Batch Print
    const handleBatchPrint = () => {
        if (selectedIds.size === 0) {
            alert('Pilih setidaknya 1 invoice untuk dicetak.');
            return;
        }
        const idsArray = Array.from(selectedIds);
        const url = `/public/invoice-seragam/batch?ids=${idsArray.join(',')}`;
        window.open(url, '_blank');
    };

    // Open WhatsApp Billing Modal
    const handleOpenWAModal = (sale = null) => {
        setWaResult(null);
        if (sale) {
            setWaModal({ open: true, singleSale: sale, isBatch: false });
        } else {
            if (spmbSelectedSales.length === 0) {
                alert('Pilih setidaknya 1 pesanan SPMB yang memiliki nomor WhatsApp untuk dikirimi tagihan.');
                return;
            }
            setWaModal({ open: true, singleSale: null, isBatch: true });
        }
    };

    // Send WhatsApp Billing
    const handleSendWA = async (e) => {
        e.preventDefault();
        setIsSendingWA(true);
        setWaResult(null);

        try {
            if (waModal.isBatch) {
                const ids = spmbSelectedSales.map(s => s.id);
                const res = await api.post('/uniforms/sales/batch-send-billing-wa', {
                    ids,
                    deadline: waDeadline,
                    customNote: waCustomNote
                });
                setWaResult({
                    type: 'success',
                    message: res.data.message || 'Pesan tagihan WhatsApp berhasil diproses!'
                });
            } else if (waModal.singleSale) {
                const res = await api.post(`/uniforms/sales/${waModal.singleSale.id}/send-billing-wa`, {
                    deadline: waDeadline,
                    customNote: waCustomNote
                });
                setWaResult({
                    type: 'success',
                    message: res.data.message || `Tagihan WhatsApp berhasil dikirim ke ${res.data.phone}`
                });
            }
        } catch (error) {
            setWaResult({
                type: 'error',
                message: error.response?.data?.error || 'Gagal mengirimkan tagihan WhatsApp.'
            });
        } finally {
            setIsSendingWA(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Header / Filter Toolbar Card */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20">
                            <Printer size={20} />
                        </div>
                        <div>
                            <h2 className="text-base sm:text-lg font-bold text-slate-800">Cetak Invoice Massal & Tagihan SPMB</h2>
                            <p className="text-xs text-slate-500">
                                Format <strong>6 Invoice per Lembar A4</strong> (Grid 2×3) & Broadcast Tagihan WhatsApp Wali Murid
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onRefresh}
                        className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                        title="Segarkan Data"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Segarkan
                    </button>
                </div>

                {/* Filters Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 pt-2 border-t border-slate-100">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Cari siswa / kode / no HP..."
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Type Filter */}
                    <select
                        value={typeFilter}
                        onChange={e => setTypeFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="ALL">-- Semua Tipe Pesanan --</option>
                        <option value="SPMB">Pesanan SPMB Saja</option>
                        <option value="RETAIL">Pesanan Warid (Retail) Saja</option>
                    </select>

                    {/* Unit Filter */}
                    <select
                        value={unitFilter}
                        onChange={e => setUnitFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="ALL">-- Semua Unit Sekolah --</option>
                        {units.map(u => (
                            <option key={u.id} value={u.name}>{u.name}</option>
                        ))}
                    </select>

                    {/* Payment Status Filter */}
                    <select
                        value={paymentFilter}
                        onChange={e => setPaymentFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="ALL">-- Status Pembayaran --</option>
                        <option value="UNPAID">Belum Lunas (Unpaid)</option>
                        <option value="PARTIAL">Parsial (Sebagian)</option>
                        <option value="PAID">Lunas (Paid)</option>
                    </select>

                    {/* Goods Status Filter */}
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="ALL">-- Status Pengambilan --</option>
                        <option value="SEDIA">Siap Diambil (SEDIA)</option>
                        <option value="DIAMBIL">Sudah Diterima (DIAMBIL)</option>
                        <option value="INDENT">Inden / Menunggu Stok</option>
                        <option value="PENDING">Pending (Belum Dicek)</option>
                    </select>
                </div>
            </div>

            {/* Sticky Action & Selection Summary Bar */}
            <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-4 rounded-2xl shadow-xl flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <span className="bg-white/20 px-3 py-1 rounded-xl text-xs font-bold tracking-wide">
                            {selectedIds.size} dari {filteredSales.length} Pesanan Terpilih
                        </span>
                        {selectedIds.size > 0 && (
                            <span className="text-xs text-blue-200">
                                Total Tagihan: <strong className="text-white font-mono">Rp {totalSelectedAmount.toLocaleString('id-ID')}</strong>
                                {totalSelectedRemaining > 0 && (
                                    <> • Sisa: <strong className="text-rose-300 font-mono">Rp {totalSelectedRemaining.toLocaleString('id-ID')}</strong></>
                                )}
                            </span>
                        )}
                    </div>
                    {/* Quick Selection Buttons */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                        <button
                            type="button"
                            onClick={handleSelectAllFiltered}
                            className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[11px] font-semibold transition"
                        >
                            {selectedIds.size === filteredSales.length && filteredSales.length > 0 ? 'Batal Pilih Semua' : 'Pilih Semua'}
                        </button>
                        <button
                            type="button"
                            onClick={handleSelectUnpaid}
                            className="px-2.5 py-1 bg-rose-500/30 hover:bg-rose-500/50 text-rose-200 rounded-lg text-[11px] font-semibold transition"
                        >
                            Pilih Belum Lunas
                        </button>
                        <button
                            type="button"
                            onClick={handleSelectReady}
                            className="px-2.5 py-1 bg-emerald-500/30 hover:bg-emerald-500/50 text-emerald-200 rounded-lg text-[11px] font-semibold transition"
                        >
                            Pilih Siap Diambil (SEDIA)
                        </button>
                    </div>
                </div>

                {/* Main Action Buttons */}
                <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                    {/* Send WhatsApp Billing Button */}
                    <button
                        type="button"
                        onClick={() => handleOpenWAModal(null)}
                        disabled={spmbSelectedSales.length === 0}
                        className="flex-1 sm:flex-initial px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Kirimkan tagihan WhatsApp resmi ke seluruh wali murid SPMB yang terpilih"
                    >
                        <Send size={15} />
                        Kirim WA Tagihan ({spmbSelectedSales.length} SPMB)
                    </button>

                    {/* Batch Print Button */}
                    <button
                        type="button"
                        onClick={handleBatchPrint}
                        disabled={selectedIds.size === 0}
                        className="flex-1 sm:flex-initial px-5 py-2.5 bg-white hover:bg-blue-50 text-blue-900 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <Printer size={16} className="text-blue-600" />
                        Cetak {selectedIds.size} Invoice (6/Lembar)
                    </button>
                </div>
            </div>

            {/* Table of Orders */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                                <th className="p-3 w-10 text-center">
                                    <input
                                        type="checkbox"
                                        checked={filteredSales.length > 0 && selectedIds.size === filteredSales.length}
                                        onChange={handleSelectAllFiltered}
                                        className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                                    />
                                </th>
                                <th className="p-3">No. Invoice & Tanggal</th>
                                <th className="p-3">Pemesan / Siswa</th>
                                <th className="p-3">Unit Sekolah</th>
                                <th className="p-3">Rincian Seragam</th>
                                <th className="p-3">Tagihan & Bayar</th>
                                <th className="p-3 text-center">Status Bayar</th>
                                <th className="p-3 text-center">Status Barang</th>
                                <th className="p-3 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="9" className="p-8 text-center text-slate-400">
                                        <Loader2 size={24} className="animate-spin mx-auto mb-2 text-blue-600" />
                                        Memuat data invoice...
                                    </td>
                                </tr>
                            ) : filteredSales.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="p-8 text-center text-slate-400 italic">
                                        Tidak ada data pesanan seragam yang sesuai dengan filter.
                                    </td>
                                </tr>
                            ) : (
                                filteredSales.map(sale => {
                                    const isSelected = selectedIds.has(sale.id);
                                    const isPaid = sale.paymentStatus === 'PAID';
                                    const isPartial = sale.paymentStatus === 'PARTIAL';
                                    const studentName = sale.customerName || sale.studentName || '-';
                                    const sisa = Math.max(0, (sale.totalAmount || 0) - (sale.paidAmount || 0));

                                    return (
                                        <tr 
                                            key={sale.id}
                                            onClick={() => handleToggleSelect(sale.id)}
                                            className={`hover:bg-blue-50/40 transition-colors cursor-pointer ${
                                                isSelected ? 'bg-blue-50/70' : ''
                                            }`}
                                        >
                                            <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => handleToggleSelect(sale.id)}
                                                    className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                                                />
                                            </td>

                                            {/* Invoice & Date */}
                                            <td className="p-3">
                                                <div className="font-bold text-slate-800 font-mono flex items-center gap-1.5">
                                                    <span>{sale.code}</span>
                                                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-sans font-extrabold ${
                                                        sale.type === 'SPMB' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-700'
                                                    }`}>
                                                        {sale.type}
                                                    </span>
                                                </div>
                                                <div className="text-[10px] text-slate-400 mt-0.5">
                                                    {new Date(sale.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </div>
                                            </td>

                                            {/* Student */}
                                            <td className="p-3">
                                                <div className="font-bold text-slate-800">{studentName}</div>
                                                <div className="text-[10px] text-slate-500 font-mono">{sale.customerPhone || 'Tanpa No HP'}</div>
                                            </td>

                                            {/* Unit */}
                                            <td className="p-3 font-semibold text-slate-700">
                                                {sale.targetUnit || '-'}
                                            </td>

                                            {/* Items */}
                                            <td className="p-3 max-w-[200px]">
                                                <div className="space-y-0.5 text-[11px] truncate">
                                                    {sale.items && sale.items.length > 0 ? (
                                                        sale.items.slice(0, 2).map((item, i) => (
                                                            <div key={i} className="truncate text-slate-600">
                                                                • {item.itemName} <strong className="text-slate-800 font-sans">({item.size})</strong>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <span className="text-slate-400 italic">{sale.package?.name || 'Paket SPMB'}</span>
                                                    )}
                                                    {sale.items && sale.items.length > 2 && (
                                                        <div className="text-[10px] text-blue-600 font-bold">
                                                            +{sale.items.length - 2} item lainnya
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Amounts */}
                                            <td className="p-3">
                                                <div className="font-black text-slate-900 font-mono">
                                                    Rp {(sale.totalAmount || 0).toLocaleString('id-ID')}
                                                </div>
                                                {sisa > 0 ? (
                                                    <div className="text-[10px] text-rose-600 font-bold">
                                                        Sisa: Rp {sisa.toLocaleString('id-ID')}
                                                    </div>
                                                ) : (
                                                    <div className="text-[10px] text-emerald-600 font-bold">
                                                        ✓ Terbayar Penuh
                                                    </div>
                                                )}
                                            </td>

                                            {/* Payment Badge */}
                                            <td className="p-3 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black inline-block ${
                                                    isPaid 
                                                        ? 'bg-emerald-100 text-emerald-800' 
                                                        : (isPartial ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800')
                                                }`}>
                                                    {isPaid ? 'LUNAS' : (isPartial ? 'PARSIAL' : 'BELUM')}
                                                </span>
                                            </td>

                                            {/* Goods Badge */}
                                            <td className="p-3 text-center">
                                                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold inline-block ${
                                                    sale.status === 'SEDIA' 
                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                                        : (sale.status === 'DIAMBIL' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-600')
                                                }`}>
                                                    {sale.status === 'SEDIA' ? 'Siap Diambil' : (sale.status === 'DIAMBIL' ? 'Sudah Diambil' : sale.status)}
                                                </span>
                                            </td>

                                            {/* Row Actions */}
                                            <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                                                <div className="flex items-center justify-center gap-1.5">
                                                    {/* Single Public Invoice */}
                                                    <a
                                                        href={`/public/invoice-seragam/${sale.id}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                                                        title="Lihat Invoice Satuan"
                                                    >
                                                        <FileText size={14} />
                                                    </a>

                                                    {/* WhatsApp Single Bill */}
                                                    {sale.type === 'SPMB' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenWAModal(sale)}
                                                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition"
                                                            title="Kirim Tagihan WA ke Pemesan Ini"
                                                        >
                                                            <Send size={14} />
                                                        </button>
                                                    )}

                                                    {/* Payment Update Modal */}
                                                    {onUpdatePayment && (
                                                        <button
                                                            type="button"
                                                            onClick={() => onUpdatePayment(sale)}
                                                            className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition"
                                                            title="Kelola Pembayaran"
                                                        >
                                                            <CreditCard size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── WHATSAPP BILLING MODAL ── */}
            {waModal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                                    <Send size={18} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                                        {waModal.isBatch ? `Kirim Tagihan SPMB Massal (${spmbSelectedSales.length} Pesanan)` : 'Kirim Tagihan WhatsApp SPMB'}
                                    </h3>
                                    <p className="text-[11px] text-slate-500">
                                        {waModal.singleSale ? `${waModal.singleSale.customerName} (${waModal.singleSale.customerPhone || 'No HP -'})` : 'Pesan otomatis ditujukan ke Admin Unit sekolah terkait'}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setWaModal({ open: false, singleSale: null, isBatch: false })} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>

                        {waResult && (
                            <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                                waResult.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
                            }`}>
                                {waResult.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                                <span>{waResult.message}</span>
                            </div>
                        )}

                        <form onSubmit={handleSendWA} className="space-y-3.5">
                            {/* Batas Waktu Pembayaran */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Batas Waktu Pembayaran (Deadline) *
                                </label>
                                <input
                                    type="text"
                                    value={waDeadline}
                                    onChange={e => setWaDeadline(e.target.value)}
                                    placeholder="Contoh: 15 Juli 2026 / Sebelum Masuk Sekolah"
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                                    required
                                />
                            </div>

                            {/* Catatan Tambahan */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Catatan Tambahan (Opsional)
                                </label>
                                <textarea
                                    value={waCustomNote}
                                    onChange={e => setWaCustomNote(e.target.value)}
                                    placeholder="Contoh: Pengambilan seragam dapat dikoordinasikan dengan loket sarpras setiap hari kerja."
                                    rows={2}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 resize-none outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            {/* Format Preview Info */}
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
                                <div className="font-bold text-slate-700 flex items-center gap-1.5">
                                    <MessageSquare size={13} className="text-emerald-600" /> Format Pesan yang Dikirim:
                                </div>
                                <ul className="list-disc list-inside space-y-0.5 text-[10px] text-slate-500 pl-1">
                                    <li>Salam & Tujuan: <strong>Yth. Admin Unit [Nama Unit]</strong></li>
                                    <li>Kode Invoice & Rincian Pembayaran (Total, Terbayar, Sisa)</li>
                                    <li>Batas Waktu Pembayaran (Sesuai input di atas)</li>
                                    <li>Tautan Invoice Digital & Detail Pesanan</li>
                                    <li>Pengirim: <strong>Admin Bidang Sarana Yayasan Dar El-Iman</strong></li>
                                </ul>
                            </div>

                            <div className="flex gap-2 pt-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setWaModal({ open: false, singleSale: null, isBatch: false })}
                                    className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                                >
                                    Tutup
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSendingWA}
                                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 disabled:opacity-50"
                                >
                                    {isSendingWA ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                    {isSendingWA ? 'Mengirimkan WA...' : (waModal.isBatch ? `Kirim ke ${spmbSelectedSales.length} Pesanan` : 'Kirim Tagihan Sekarang')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
