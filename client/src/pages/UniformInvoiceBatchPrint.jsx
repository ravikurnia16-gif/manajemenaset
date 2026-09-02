import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../lib/axios';
import QRCode from 'react-qr-code';
import { Printer, ArrowLeft, FileText, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

const UniformInvoiceBatchPrint = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const ids = searchParams.get('ids');
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!ids) {
            setError('Tidak ada ID pesanan yang dipilih untuk dicetak.');
            setLoading(false);
            return;
        }

        api.get(`/uniforms/sales/batch-invoice?ids=${ids}`)
            .then(res => {
                if (!res.data || res.data.length === 0) {
                    setError('Data pesanan tidak ditemukan.');
                } else {
                    setInvoices(res.data);
                }
            })
            .catch(err => setError(err.response?.data?.error || 'Gagal memuat invoice massal.'))
            .finally(() => setLoading(false));
    }, [ids]);

    if (loading) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 p-4">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent mb-3"></div>
            <p className="font-bold text-slate-600 text-sm">Menyiapkan Cetak Massal Invoice Seragam...</p>
        </div>
    );

    if (error || invoices.length === 0) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 p-4">
            <div className="bg-white p-6 rounded-2xl shadow-xl border border-red-200 text-center max-w-md space-y-3">
                <AlertTriangle size={36} className="text-red-500 mx-auto" />
                <h3 className="font-bold text-slate-800">Gagal Membuka Cetak Massal</h3>
                <p className="text-xs text-slate-600">{error || 'Data invoice kosong.'}</p>
                <button
                    onClick={() => window.close()}
                    className="px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-xl"
                >
                    Tutup Halaman
                </button>
            </div>
        </div>
    );

    // Chunk arrays per 6 items (2 cols x 3 rows per page)
    const chunkedInvoices = [];
    for (let i = 0; i < invoices.length; i += 6) {
        chunkedInvoices.push(invoices.slice(i, i + 6));
    }

    return (
        <div className="min-h-screen bg-slate-200 p-4 md:p-8 font-sans print:bg-white print:p-0">
            <style type="text/css" media="print">
                {`
                    @page { 
                        size: A4 portrait; 
                        margin: 8mm; 
                    }
                    body { 
                        -webkit-print-color-adjust: exact; 
                        print-color-adjust: exact;
                        margin: 0;
                        padding: 0;
                        background: white;
                    }
                    .page-break { page-break-after: always; }
                    .print-dashed { 
                        border: 1px dashed #cbd5e1 !important; 
                        box-shadow: none !important;
                    }
                `}
            </style>

            {/* ActionBar - Hidden on Print */}
            <div className="flex flex-wrap justify-between items-center max-w-[21cm] mx-auto mb-6 print:hidden bg-white p-4 rounded-2xl shadow-md gap-3">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => window.history.back()}
                        className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors"
                        title="Kembali"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h2 className="text-sm font-bold text-slate-800">Cetak Massal Invoice Seragam</h2>
                        <p className="text-xs text-slate-500">
                            Total <strong>{invoices.length} Invoice</strong> (Format 6 Invoice per Lembar A4)
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => window.print()} 
                        className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-200 transition-all"
                    >
                        <Printer size={16} /> Cetak / Simpan PDF
                    </button>
                </div>
            </div>

            {/* Pages Container */}
            <div className="max-w-[21cm] w-full mx-auto pb-16 print:pb-0">
                {chunkedInvoices.map((pageInvoices, pageIdx) => (
                    <div 
                        key={pageIdx} 
                        className={`bg-white shadow-2xl mb-8 print:shadow-none print:mb-0 print:border-none ${
                            pageIdx < chunkedInvoices.length - 1 ? 'page-break' : ''
                        }`}
                        style={{ minHeight: '277mm' }}
                    >
                        {/* 2 Kolom x 3 Baris Grid (6 Invoice per Lembar A4) */}
                        <div className="grid grid-cols-2 grid-rows-3 gap-2 p-2 print:p-0 print:gap-1.5 h-[277mm] box-border">
                            {pageInvoices.map(invoice => {
                                const qrData = `${window.location.origin}/public/invoice-seragam/${invoice.id}`;
                                const isPaid = invoice.paymentStatus === 'PAID';
                                const isPartial = invoice.paymentStatus === 'PARTIAL';
                                const studentName = invoice.customerName || invoice.studentName || 'Siswa';
                                const unitName = invoice.targetUnit || 'Yayasan';

                                return (
                                    <div 
                                        key={invoice.id} 
                                        className="print-dashed border border-slate-300 rounded-xl p-2.5 flex flex-col justify-between relative h-full box-border overflow-hidden bg-white text-slate-800"
                                        style={{ height: '90mm' }}
                                    >
                                        {/* Header Mini */}
                                        <div className="flex justify-between items-start border-b border-slate-200 pb-1.5 mb-1.5">
                                            <div className="flex items-center gap-1.5">
                                                <div className="bg-blue-600 text-white p-1 rounded-md shrink-0">
                                                    <FileText size={12} />
                                                </div>
                                                <div>
                                                    <h1 className="text-[10px] font-black text-slate-900 leading-tight">YAYASAN DAR EL-IMAN</h1>
                                                    <div className="text-[8px] text-slate-500 font-medium">Biro Perlengkapan & Seragam</div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border inline-block ${
                                                    isPaid 
                                                        ? 'text-emerald-700 bg-emerald-50 border-emerald-300' 
                                                        : (isPartial ? 'text-amber-700 bg-amber-50 border-amber-300' : 'text-rose-700 bg-rose-50 border-rose-300')
                                                }`}>
                                                    {isPaid ? 'LUNAS' : (isPartial ? 'PARSIAL' : 'BELUM LUNAS')}
                                                </span>
                                                <div className="text-[7px] text-slate-400 font-mono font-bold mt-0.5">{invoice.code}</div>
                                            </div>
                                        </div>

                                        {/* Student & Order Info */}
                                        <div className="mb-1 flex justify-between items-start">
                                            <div className="min-w-0 flex-1 pr-1">
                                                <div className="text-[7px] text-slate-400 font-bold uppercase tracking-wider">Pemesan / Siswa:</div>
                                                <div className="font-extrabold text-slate-900 text-[10px] truncate leading-tight">{studentName}</div>
                                                <div className="text-[8px] text-blue-700 font-semibold truncate">{unitName} {invoice.customerPhone ? `• ${invoice.customerPhone}` : ''}</div>
                                            </div>
                                            {/* QR Code */}
                                            <div className="shrink-0 bg-white p-0.5 border border-slate-200 rounded">
                                                <QRCode value={qrData} size={34} level="M" />
                                            </div>
                                        </div>

                                        {/* Items Table Mini */}
                                        <div className="flex-1 overflow-hidden my-1 bg-slate-50/70 p-1.5 rounded-lg border border-slate-100">
                                            <div className="text-[7px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 flex justify-between">
                                                <span>Item Seragam</span>
                                                <span>Qty</span>
                                            </div>
                                            <div className="space-y-0.5 overflow-hidden text-[8px] leading-tight max-h-[28mm]">
                                                {(invoice.items && invoice.items.length > 0) ? (
                                                    invoice.items.slice(0, 4).map((item, idx) => (
                                                        <div key={idx} className="flex justify-between items-center text-slate-700 truncate">
                                                            <span className="truncate pr-1">• {item.itemName} <span className="font-bold text-slate-900">({item.size})</span></span>
                                                            <span className="font-mono text-slate-600 shrink-0 font-bold">x{item.qty}</span>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="text-[8px] text-slate-500 italic">
                                                        {invoice.package?.name || 'Paket Seragam SPMB'}
                                                    </div>
                                                )}
                                                {invoice.items && invoice.items.length > 4 && (
                                                    <div className="text-[7px] text-slate-400 font-semibold italic">
                                                        +{invoice.items.length - 4} item lainnya...
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Total & Footer Note */}
                                        <div className="border-t border-slate-200 pt-1 flex justify-between items-center text-[8px]">
                                            <div>
                                                <span className="text-slate-400 text-[7px] block leading-none">Total Tagihan:</span>
                                                <span className="font-black text-slate-900 text-[10px]">
                                                    Rp {(invoice.totalAmount || 0).toLocaleString('id-ID')}
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[7px] text-slate-400 block leading-none">
                                                    {isPaid ? 'Lunas: Kasir' : `Sisa: Rp ${Math.max(0, (invoice.totalAmount || 0) - (invoice.paidAmount || 0)).toLocaleString('id-ID')}`}
                                                </span>
                                                <span className="text-[7px] font-bold text-emerald-700">
                                                    {invoice.status === 'SEDIA' ? '✓ Siap Diambil' : (invoice.status === 'DIAMBIL' ? '✓ Sudah Diterima' : 'Diproses')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default UniformInvoiceBatchPrint;
