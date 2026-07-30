import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Package, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import api from '../../../lib/axios';

const formatRupiah = (number) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(number || 0);
};

export default function UniformFinancePage() {
    const [data, setData] = useState({
        summary: { totalRevenue: 0, totalExpenses: 0, netProfit: 0, totalAssetValue: 0 },
        cashFlow: []
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/uniforms/finance-report')
            .then(res => setData(res.data))
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="p-8 text-center text-slate-500">Memuat data keuangan...</div>;

    const { summary, cashFlow } = data;
    const isProfit = summary.netProfit >= 0;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
                    <DollarSign size={24} />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Laporan Keuangan Seragam</h2>
                    <p className="text-sm text-slate-500">Ringkasan pendapatan, pengeluaran, dan arus kas.</p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-sm font-medium text-slate-500">Total Pendapatan</p>
                        <div className="p-2 bg-green-100 text-green-600 rounded-lg"><TrendingUp size={16} /></div>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800">{formatRupiah(summary.totalRevenue)}</h3>
                    <p className="text-xs text-slate-500 mt-1">Dari Penjualan Seragam</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-sm font-medium text-slate-500">Total Pengeluaran</p>
                        <div className="p-2 bg-red-100 text-red-600 rounded-lg"><TrendingDown size={16} /></div>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800">{formatRupiah(summary.totalExpenses)}</h3>
                    <p className="text-xs text-slate-500 mt-1">Biaya Proyek Pengadaan</p>
                </div>

                <div className={`bg-white p-5 rounded-2xl border shadow-sm ${isProfit ? 'border-green-200' : 'border-red-200'}`}>
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-sm font-medium text-slate-500">Laba / Rugi Bersih</p>
                        <div className={`p-2 rounded-lg ${isProfit ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                            {isProfit ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                        </div>
                    </div>
                    <h3 className={`text-2xl font-bold ${isProfit ? 'text-green-700' : 'text-red-700'}`}>
                        {formatRupiah(Math.abs(summary.netProfit))}
                    </h3>
                    <p className={`text-xs mt-1 ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                        {isProfit ? 'Keuntungan' : 'Kerugian'} (Revenue - Expenses)
                    </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-sm font-medium text-slate-500">Potensi Nilai Aset</p>
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Package size={16} /></div>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800">{formatRupiah(summary.totalAssetValue)}</h3>
                    <p className="text-xs text-slate-500 mt-1">Estimasi nilai sisa stok gudang</p>
                </div>
            </div>

            {/* Cash Flow Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100">
                    <h3 className="font-bold text-slate-800">Riwayat Arus Kas (Terbaru)</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                                <th className="p-4 font-bold w-40">Waktu</th>
                                <th className="p-4 font-bold w-32">Tipe</th>
                                <th className="p-4 font-bold">Keterangan / Referensi</th>
                                <th className="p-4 font-bold text-right w-48">Nominal</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-slate-100">
                            {cashFlow.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="p-8 text-center text-slate-500">Belum ada transaksi keuangan.</td>
                                </tr>
                            ) : cashFlow.map((trx, idx) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                    <td className="p-4 whitespace-nowrap text-slate-600">
                                        {new Date(trx.date).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit' })}
                                    </td>
                                    <td className="p-4">
                                        {trx.type === 'IN' ? (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">
                                                <ArrowDownRight size={12} /> Pemasukan
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                                                <ArrowUpRight size={12} /> Pengeluaran
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <p className="font-medium text-slate-800">{trx.description}</p>
                                        <p className="text-xs text-slate-400">Ref: {trx.reference}</p>
                                    </td>
                                    <td className="p-4 text-right font-bold">
                                        <span className={trx.type === 'IN' ? 'text-green-600' : 'text-red-600'}>
                                            {trx.type === 'IN' ? '+' : '-'} {formatRupiah(trx.amount)}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
