import React from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { Badge } from './UIComponents';

export const TransactionsTab = ({ transactions, loading, selectedWarehouse, setSelectedWarehouse, warehouses, openModal }) => {
    const renderNoteCell = (t) => {
        const isExchange = t.referenceType === 'EXCHANGE' || 
                           t.reason?.toLowerCase().includes('tukar ukuran') || 
                           t.note?.toLowerCase().includes('tukar ukuran');

        let primaryNote = t.note;
        let secondaryNote = t.reason;

        // Jika transaksi tukar ukuran tetapi note belum tersimpan (transaksi lama)
        if (isExchange && !primaryNote) {
            primaryNote = secondaryNote || (t.type === 'IN' 
                ? 'Tukar Ukuran: Pengembalian seragam lama kembali masuk stok gudang' 
                : 'Tukar Ukuran: Penyerahan seragam ukuran baru kepada pemesan');
            secondaryNote = null;
        }

        if (!primaryNote && secondaryNote) {
            primaryNote = secondaryNote;
            secondaryNote = null;
        } else if (primaryNote && secondaryNote && (primaryNote === secondaryNote || primaryNote.includes(secondaryNote))) {
            secondaryNote = null;
        }

        if (!primaryNote && !secondaryNote) {
            if (t.referenceType === 'SALE') {
                primaryNote = 'Penjualan / Pengambilan Seragam Siswa';
            } else if (t.referenceType === 'PURCHASE') {
                primaryNote = 'Penerimaan Stok Pembelian dari Vendor';
            } else if (t.referenceType === 'OPNAME') {
                primaryNote = 'Penyesuaian Stok Opname';
            } else {
                return <span className="text-slate-400 italic">-</span>;
            }
        }

        return (
            <div className="space-y-1.5 py-0.5">
                {isExchange && (
                    <div className="inline-flex items-center gap-1.5 font-semibold text-purple-700 bg-purple-50 border border-purple-200/80 px-2 py-0.5 rounded text-[11px]">
                        <RefreshCw size={11} className="shrink-0" />
                        <span>Tukar Ukuran</span>
                        <span className="text-purple-500 font-normal">
                            • {t.type === 'IN' ? 'Barang Lama Masuk' : 'Ukuran Baru Keluar'}
                        </span>
                    </div>
                )}
                <div className="text-slate-700 whitespace-normal break-words leading-relaxed text-xs">
                    {primaryNote}
                </div>
                {secondaryNote && (
                    <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200/60 rounded-lg px-2 py-1 whitespace-normal break-words leading-tight">
                        <span className="font-semibold text-slate-600">Alasan: </span>
                        {secondaryNote}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2 items-center">
                <select className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white outline-none" value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)}>
                    <option value="">Semua Gudang</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                <button onClick={() => openModal('transaction')} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-blue-500/20 ml-auto">
                    <Plus size={14} /> Transaksi Baru
                </button>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
                <table className="w-full text-sm min-w-[850px]">
                    <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                        <tr>
                            <th className="p-3 text-left w-36">Kode</th>
                            <th className="p-3 text-center w-24">Tipe</th>
                            <th className="p-3 text-left w-52">Barang</th>
                            <th className="p-3 text-center w-36">Gudang</th>
                            <th className="p-3 text-center w-20">Qty</th>
                            <th className="p-3 text-center w-28">Tanggal</th>
                            <th className="p-3 text-left min-w-[280px]">Catatan / Keterangan</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan="7" className="p-8 text-center text-slate-400">Memuat data...</td></tr>
                        ) : transactions.length === 0 ? (
                            <tr><td colSpan="7" className="p-8 text-center text-slate-400">Belum ada transaksi stok.</td></tr>
                        ) : transactions.map(t => (
                            <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="p-3 font-mono text-xs text-slate-400 align-top">{t.code}</td>
                                <td className="p-3 text-center align-top">
                                    <Badge color={t.type === 'IN' ? 'green' : t.type === 'OUT' ? 'red' : t.type === 'MUTATION' ? 'blue' : 'orange'}>{t.type}</Badge>
                                    {t.referenceType === 'EXCHANGE' && (
                                        <span className="block mt-1 text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 rounded px-1.5 py-0.5 whitespace-nowrap">
                                            Tukar
                                        </span>
                                    )}
                                </td>
                                <td className="p-3 font-medium text-slate-700 align-top">{t.variant?.item?.name} ({t.variant?.sizeName || '-'})</td>
                                <td className="p-3 text-center text-xs text-slate-500 align-top">
                                    {t.warehouse?.name}
                                    {t.toWarehouse && <span className="text-blue-500 font-medium"> → {t.toWarehouse.name}</span>}
                                </td>
                                <td className="p-3 text-center font-bold align-top">{t.quantity > 0 ? `+${t.quantity}` : t.quantity}</td>
                                <td className="p-3 text-center text-xs text-slate-500 align-top">{new Date(t.createdAt).toLocaleDateString('id-ID')}</td>
                                <td className="p-3 align-top min-w-[280px]">
                                    {renderNoteCell(t)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
