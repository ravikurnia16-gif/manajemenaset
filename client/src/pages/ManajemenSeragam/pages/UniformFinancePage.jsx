import React, { useState, useEffect } from 'react';
import {
    DollarSign, TrendingUp, TrendingDown, Package, ArrowUpRight, ArrowDownRight,
    Calendar, Printer, Loader2, RefreshCw, Clock
} from 'lucide-react';
import api from '../../../lib/axios';

/* ── jsPDF + autoTable CDN loader ── */
function loadJsPDF() {
    return new Promise((resolve) => {
        if (window.jspdf) { resolve(window.jspdf.jsPDF); return; }
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        s.onload = () => {
            const s2 = document.createElement('script');
            s2.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
            s2.onload = () => resolve(window.jspdf.jsPDF);
            document.head.appendChild(s2);
        };
        document.head.appendChild(s);
    });
}

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
    const [isExporting, setIsExporting] = useState(false);
    const [datePreset, setDatePreset] = useState('ALL');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [showCustomRange, setShowCustomRange] = useState(false);

    const computeRange = (preset) => {
        const now = new Date();
        const toYMD = (d) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        const todayStr = toYMD(now);

        if (preset === 'TODAY') return { startDate: todayStr, endDate: todayStr };
        if (preset === 'THIS_WEEK') {
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(new Date().setDate(diff));
            return { startDate: toYMD(monday), endDate: todayStr };
        }
        if (preset === 'LAST_7_DAYS') {
            const sevenDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
            return { startDate: toYMD(sevenDaysAgo), endDate: todayStr };
        }
        if (preset === 'THIS_MONTH') {
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            return { startDate: toYMD(firstDay), endDate: todayStr };
        }
        if (preset === 'LAST_30_DAYS') {
            const thirtyDaysAgo = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
            return { startDate: toYMD(thirtyDaysAgo), endDate: todayStr };
        }
        return { startDate: '', endDate: '' };
    };

    const fetchFinance = async () => {
        setLoading(true);
        try {
            const params = {};
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;
            const res = await api.get('/uniforms/finance-report', { params });
            setData(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFinance();
    }, [startDate, endDate]);

    const handlePresetChange = (preset) => {
        setDatePreset(preset);
        if (preset === 'ALL') {
            setShowCustomRange(false);
            setStartDate('');
            setEndDate('');
        } else if (preset === 'CUSTOM') {
            setShowCustomRange(true);
        } else {
            setShowCustomRange(false);
            const r = computeRange(preset);
            setStartDate(r.startDate);
            setEndDate(r.endDate);
        }
    };

    const handleExportPDF = async () => {
        setIsExporting(true);
        try {
            const jsPDF = await loadJsPDF();
            const doc = new jsPDF('portrait', 'mm', 'a4');
            const pageW = doc.internal.pageSize.getWidth();
            const now = new Date();

            let periodLabel = 'Semua Periode Data';
            if (startDate && endDate) {
                const sStr = new Date(startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
                const eStr = new Date(endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
                periodLabel = `${sStr} s/d ${eStr}`;
                if (datePreset === 'LAST_7_DAYS' || datePreset === 'THIS_WEEK') periodLabel += ' (Mingguan)';
            }

            // Header
            doc.setFontSize(16);
            doc.setFont(undefined, 'bold');
            doc.text('BIDANG SARANA & PRASARANA', pageW / 2, 16, { align: 'center' });
            doc.setFontSize(11);
            doc.setTextColor(37, 99, 235);
            doc.text('LAPORAN KEUANGAN & ARUS KAS SERAGAM', pageW / 2, 23, { align: 'center' });
            doc.setFontSize(8.5);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(100, 116, 139);
            doc.text(`Periode: ${periodLabel}   |   Tanggal Cetak: ${now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, pageW / 2, 29, { align: 'center' });

            doc.setDrawColor(203, 213, 225);
            doc.setLineWidth(0.6);
            doc.line(14, 32, pageW - 14, 32);

            // Ringkasan Keuangan
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text('1. Ringkasan Keuangan & Laba/Rugi', 14, 38);

            doc.autoTable({
                startY: 42,
                head: [['Total Pendapatan', 'Total Pengeluaran', 'Laba / Rugi Bersih', 'Potensi Nilai Aset Fisik']],
                body: [[
                    formatRupiah(summary.totalRevenue),
                    formatRupiah(summary.totalExpenses),
                    `${summary.netProfit >= 0 ? '+' : '-'} ${formatRupiah(Math.abs(summary.netProfit))}`,
                    formatRupiah(summary.totalAssetValue)
                ]],
                theme: 'grid',
                headStyles: { fillColor: [37, 99, 235], fontSize: 8.5, fontStyle: 'bold', halign: 'center' },
                bodyStyles: { fontSize: 8.5, fontStyle: 'bold', halign: 'center', textColor: [30, 41, 59] },
                margin: { left: 14, right: 14 }
            });

            // Arus Kas
            const startY2 = doc.lastAutoTable.finalY + 8;
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.text('2. Riwayat Arus Kas dalam Periode', 14, startY2);

            const cfHead = [['#', 'Waktu', 'Tipe', 'Keterangan', 'Referensi', 'Nominal']];
            const cfBody = cashFlow.map((cf, i) => [
                i + 1,
                new Date(cf.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
                cf.type === 'IN' ? 'Pemasukan' : 'Pengeluaran',
                cf.description || '-',
                cf.reference || '-',
                `${cf.type === 'IN' ? '+' : '-'} ${formatRupiah(cf.amount)}`
            ]);

            doc.autoTable({
                startY: startY2 + 4,
                head: cfHead,
                body: cfBody,
                theme: 'striped',
                headStyles: { fillColor: [79, 70, 229], fontSize: 8, fontStyle: 'bold' },
                bodyStyles: { fontSize: 7.5 },
                margin: { left: 14, right: 14 }
            });

            // Signatures
            let signY = doc.lastAutoTable.finalY + 12;
            if (signY > doc.internal.pageSize.getHeight() - 40) {
                doc.addPage();
                signY = 25;
            }

            doc.setFontSize(8.5);
            doc.setTextColor(51, 65, 85);
            doc.setFont(undefined, 'normal');
            doc.text('Dibuat Oleh,', 25, signY);
            doc.text('Bendahara / Staf Seragam', 25, signY + 5);
            doc.text('( ............................................. )', 25, signY + 26);

            doc.text('Mengetahui,', pageW - 85, signY);
            doc.text('Kepala Bidang Sarana', pageW - 85, signY + 5);
            doc.text('( ............................................. )', pageW - 85, signY + 26);

            doc.save(`Laporan_Keuangan_Seragam_${now.toISOString().slice(0, 10)}.pdf`);
        } catch (e) {
            console.error(e);
            alert('Gagal mengekspor PDF: ' + e.message);
        } finally {
            setIsExporting(false);
        }
    };

    const { summary, cashFlow } = data;
    const isProfit = summary.netProfit >= 0;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
                        <DollarSign size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Laporan Keuangan Seragam</h2>
                        <p className="text-sm text-slate-500">Ringkasan pendapatan, pengeluaran, dan arus kas mingguan / per tanggal.</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExportPDF}
                        disabled={isExporting}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm shadow-blue-500/20 disabled:opacity-50"
                    >
                        {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
                        <span>{isExporting ? 'Menyusun PDF...' : 'Cetak Laporan PDF'}</span>
                    </button>
                    <button
                        onClick={fetchFinance}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin text-blue-600' : 'text-slate-500'} />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700">
                        <Calendar size={14} className="text-indigo-600" />
                        <span>Periode Keuangan:</span>
                        <select
                            value={datePreset}
                            onChange={(e) => handlePresetChange(e.target.value)}
                            className="bg-transparent font-extrabold text-indigo-700 outline-none cursor-pointer"
                        >
                            <option value="ALL">⚡ Semua Riwayat Data</option>
                            <option value="LAST_7_DAYS">📅 7 Hari Terakhir (Mingguan)</option>
                            <option value="THIS_WEEK">📅 Minggu Ini</option>
                            <option value="THIS_MONTH">📅 Bulan Ini</option>
                            <option value="LAST_30_DAYS">📅 30 Hari Terakhir</option>
                            <option value="CUSTOM">🗓️ Pilih Rentang Tanggal...</option>
                        </select>
                    </div>

                    {(startDate || endDate) && (
                        <div className="flex items-center gap-2 text-xs bg-blue-50 text-blue-800 px-3 py-1.5 rounded-lg border border-blue-200">
                            <Clock size={13} />
                            <span>
                                {startDate ? new Date(startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Awal'} s/d {endDate ? new Date(endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Hari Ini'}
                            </span>
                        </div>
                    )}
                </div>

                {showCustomRange && (
                    <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 bg-slate-50/50 p-2.5 rounded-xl">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500">Mulai:</span>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 outline-none"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500">Sampai:</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 outline-none"
                            />
                        </div>
                        <button
                            onClick={() => handlePresetChange('ALL')}
                            className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition"
                        >
                            Reset
                        </button>
                    </div>
                )}
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-sm font-medium text-slate-500">Total Pendapatan</p>
                        <div className="p-2 bg-green-100 text-green-600 rounded-lg"><TrendingUp size={16} /></div>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800">{formatRupiah(summary.totalRevenue)}</h3>
                    <p className="text-xs text-slate-500 mt-1">Dari Pesanan Seragam</p>
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
                                        {new Date(trx.date).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
