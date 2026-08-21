import { Search, ShoppingCart, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { Badge } from './UIComponents';
import React from 'react';

export const SalesTab = ({ sales, loading, search, setSearch, openModal, canFulfill, onDelete, onUpdatePayment }) => (
    <div className="space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input type="text" placeholder="Cari kode, nama pelanggan, atau siswa..." className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-100" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button onClick={() => openModal('sale')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700">
                <ShoppingCart size={14} /> Buat Pesanan
            </button>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                    <tr>
                        <th className="p-3 text-left">Invoice</th>
                        <th className="p-3 text-left">Pelanggan</th>
                        <th className="p-3 text-center">Tipe</th>
                        <th className="p-3 text-right">Total</th>
                        <th className="p-3 text-center">Bayar</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3 text-center">Tanggal</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {loading ? (
                        <tr><td colSpan="7" className="p-8 text-center text-slate-400">Memuat data...</td></tr>
                    ) : sales.length === 0 ? (
                        <tr><td colSpan="7" className="p-8 text-center text-slate-400">Belum ada transaksi pesanan.</td></tr>
                    ) : sales.map(s => {
                        const hasPackages = s.salePackages && s.salePackages.length > 0;
                        const activeSubtotal = (s.type === 'SPMB' || s.type === 'UNIT_ORDER')
                            ? s.subtotal
                            : (s.items?.filter(item => item.status !== 'BATAL').reduce((acc, item) => acc + item.totalPrice, 0) || s.subtotal);
                        const activeTotalAmount = Math.max(0, activeSubtotal - (s.discount || 0));
                        
                        return (
                            <React.Fragment key={s.id}>
                                <tr className="hover:bg-slate-50/80 transition-colors">
                                    <td className="p-3 font-mono text-xs text-slate-400">{s.code}</td>
                                    <td className="p-3">
                                        <div className="font-bold text-slate-800">{s.customerName}</div>
                                        {s.studentName && <div className="text-[10px] text-slate-400">Siswa: {s.studentName}</div>}
                                    </td>
                                    <td className="p-3 text-center"><Badge color={s.type === 'SPMB' || s.type === 'UNIT_ORDER' ? 'purple' : 'slate'}>{s.type}</Badge></td>
                                    <td className="p-3 text-right">
                                        {s.totalAmount > activeTotalAmount ? (
                                            <div className="flex flex-col items-end">
                                                <span className="text-xs text-rose-400 line-through" title="Total Awal">Rp {(s.totalAmount).toLocaleString('id-ID')}</span>
                                                <span className="font-bold text-slate-700" title="Total Setelah Batal">Rp {activeTotalAmount.toLocaleString('id-ID')}</span>
                                            </div>
                                        ) : (
                                            <span className="font-bold text-slate-700">Rp {activeTotalAmount.toLocaleString('id-ID')}</span>
                                        )}
                                    </td>
                                    <td className="p-3 text-center">
                                        <Badge color={s.paymentStatus === 'PAID' ? 'green' : s.paymentStatus === 'PARTIAL' ? 'orange' : 'red'}>{s.paymentStatus}</Badge>
                                        {onUpdatePayment && (
                                            <button 
                                                onClick={() => onUpdatePayment(s.id, s.paymentStatus === 'PAID' ? 'UNPAID' : 'PAID')}
                                                className={`mt-2 mx-auto flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded transition-colors ${
                                                    s.paymentStatus === 'PAID' 
                                                        ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                                                        : 'bg-green-50 text-green-600 hover:bg-green-100'
                                                }`}
                                            >
                                                {s.paymentStatus === 'PAID' ? <XCircle size={12} /> : <CheckCircle size={12} />}
                                                {s.paymentStatus === 'PAID' ? 'Batal Lunas' : 'Tandai Lunas'}
                                            </button>
                                        )}
                                    </td>
                                    <td className="p-3 text-center">
                                        <Badge color={s.status === 'SELESAI' ? 'green' : s.status === 'PROSES' ? 'blue' : s.status === 'PENDING' ? 'yellow' : 'slate'}>{s.status}</Badge>
                                        {canFulfill && s.status !== 'CANCELLED' && (
                                            <button onClick={() => openModal('fulfill', s)} className="mt-2 text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-200 block mx-auto whitespace-nowrap">
                                                Kelola Item
                                            </button>
                                        )}
                                    </td>
                                    <td className="p-3 text-center">
                                        <div className="text-xs text-slate-500 mb-1">{new Date(s.createdAt).toLocaleDateString('id-ID')}</div>
                                        <div className="flex items-center justify-center gap-2">
                                            <a href={`/public/invoice-seragam/${s.id}`} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-blue-600 hover:underline inline-flex items-center gap-1">
                                                Lihat Invoice
                                            </a>
                                            {s.status === 'PENDING' && onDelete && (
                                                <button onClick={() => onDelete(s.id)} className="text-[10px] font-bold text-red-500 hover:text-red-700 p-1 bg-red-50 rounded" title="Batalkan Pesanan">
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                                {hasPackages && s.salePackages.map((pkg, idx) => {
                                    // Check if this package has any pending items
                                    const pkgItems = s.items ? s.items.filter(i => i.salePackageId === pkg.id) : [];
                                    const isPkgPending = pkgItems.some(i => i.qtyDelivered < i.qty);
                                    
                                    return (
                                        <tr key={pkg.id} className="bg-slate-50 border-t border-slate-100">
                                            <td colSpan="2" className="p-3 pl-8 text-xs text-slate-600 border-r border-slate-100">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-slate-400">└</span>
                                                    <span className="font-bold">{pkg.package?.name || 'Paket'}</span>
                                                    <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">{pkg.qty}x</span>
                                                </div>
                                            </td>
                                            <td colSpan="3" className="p-3 border-r border-slate-100 text-xs text-slate-500">
                                                Harga: Rp {pkg.price.toLocaleString('id-ID')}
                                            </td>
                                            <td colSpan="2" className="p-3">
                                                {isPkgPending ? (
                                                    <div className="text-[10px] font-bold text-yellow-600 text-center bg-yellow-50 rounded py-1 border border-yellow-100">
                                                        Ada Item Pending/Proses
                                                    </div>
                                                ) : (
                                                    <div className="text-[10px] font-bold text-green-600 text-center bg-green-50 rounded py-1 border border-green-100">
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
