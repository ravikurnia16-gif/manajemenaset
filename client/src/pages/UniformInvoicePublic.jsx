import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../lib/axios';
import QRCode from 'react-qr-code';
import { Printer, MapPin, Calendar, Users, FileText, CheckCircle, Clock } from 'lucide-react';

const UniformInvoicePublic = () => {
    const { id } = useParams();
    const [invoice, setInvoice] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        api.get(`/uniforms/sales/${id}`)
            .then(res => setInvoice(res.data))
            .catch(err => setError(err.response?.data?.error || 'Invoice tidak ditemukan'))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) return <div className="p-10 text-center font-bold text-slate-500">Memuat Invoice...</div>;
    if (error || !invoice) return <div className="p-10 text-center font-bold text-red-500">{error}</div>;

    const qrData = `${window.location.origin}/public/invoice-seragam/${invoice.id}`;
    
    // Extract deadline from notes if it exists
    let deadline = null;
    if (invoice.note && invoice.note.includes('[DEADLINE:')) {
        const match = invoice.note.match(/\[DEADLINE:(.*?)\]/);
        if (match && match[1]) deadline = match[1];
    }

    const isPaid = invoice.paymentStatus === 'PAID';

    return (
        <div className="min-h-screen bg-slate-100 p-4 font-sans print:bg-white print:p-0 print:min-h-0 print:block">
            <style type="text/css" media="print">
                {`
                    @page { size: A4 portrait; margin: 10mm; }
                    body { 
                        -webkit-print-color-adjust: exact; 
                        print-color-adjust: exact;
                        margin: 0;
                        padding: 0;
                    }
                    @media print {
                        .invoice-container {
                            zoom: 0.95; /* Skala proporsional untuk A4 */
                            page-break-inside: avoid;
                            page-break-after: avoid;
                        }
                        .print\\:shadow-none { box-shadow: none !important; }
                        .print\\:rounded-none { border-radius: 0 !important; }
                        .print\\:border-none { border: none !important; }
                    }
                `}
            </style>
            <div className="max-w-3xl w-full mx-auto print:block">
                {/* ActionBar - Hidden on Print */}
                <div className="flex justify-end mb-4 print:hidden">
                    <button 
                        onClick={() => window.print()} 
                        className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-blue-200 transition-all"
                    >
                        <Printer size={18} /> Cetak / Simpan PDF
                    </button>
                </div>

                {/* Printable Invoice Container */}
                <div className="invoice-container bg-white p-6 md:p-12 rounded-[2rem] shadow-xl border border-slate-100 print:shadow-none print:rounded-none print:border-none print:p-2">
                    
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-100 pb-6 mb-6 print:pb-3 print:mb-3 gap-4 print:gap-2">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="bg-blue-600 text-white p-2 rounded-xl">
                                    <FileText size={24} />
                                </div>
                                <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">TAGIHAN SERAGAM</h1>
                            </div>
                            <div className="text-slate-500 font-medium ml-12">Layanan Pengadaan Seragam Siswa</div>
                            <div className="mt-6 ml-12 space-y-1 text-sm text-slate-600 border-l-2 border-blue-200 pl-4">
                                <div><span className="font-bold text-slate-800">Yayasan Dar el-Iman</span></div>
                                <div>Bagian Sarana dan Prasarana (Manajemen Aset)</div>
                                <div>Padang, Sumatera Barat</div>
                            </div>
                        </div>
                        <div className="text-left sm:text-right w-full sm:w-auto">
                            {isPaid ? (
                                <div className="text-xl md:text-2xl font-black text-emerald-600 border-2 border-emerald-600 px-4 py-1.5 inline-block rounded-xl rotate-[-3deg] mb-4 shadow-sm print:text-lg print:mb-2 print:px-3 print:py-1">
                                    LUNAS
                                </div>
                            ) : (
                                <div className="text-xl md:text-2xl font-black text-rose-500 border-2 border-rose-500 px-4 py-1.5 inline-block rounded-xl rotate-[3deg] mb-4 shadow-sm print:text-lg print:mb-2 print:px-3 print:py-1">
                                    BELUM LUNAS
                                </div>
                            )}
                            <div className="text-sm print:text-[10px] space-y-1 md:space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-100 print:bg-transparent print:border-none print:p-0 print:space-y-0.5">
                                <div className="flex justify-between gap-6 print:justify-end print:gap-2"><span className="text-slate-400 font-medium">No. Referensi:</span> <span className="font-bold text-slate-800">{invoice.code}</span></div>
                                <div className="flex justify-between gap-6 print:justify-end print:gap-2"><span className="text-slate-400 font-medium">Tanggal Dibuat:</span> <span className="font-bold text-slate-800">{new Date(invoice.createdAt).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
                                {deadline && (
                                    <div className="flex justify-between gap-6 print:justify-end print:gap-2 text-rose-600"><span className="font-medium">Tenggat Pelunasan:</span> <span className="font-bold">{new Date(deadline).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Meta Invoice & Customer */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 print:mb-3">
                        <div className="p-2 print:p-0">
                            <h3 className="text-[10px] print:text-[8px] font-black tracking-widest text-slate-400 uppercase mb-2 print:mb-1">Ditagihkan Kepada :</h3>
                            <div className="font-black text-slate-800 text-lg print:text-base mb-1">{invoice.customerName || 'Pelanggan'}</div>
                            {invoice.targetUnit && (
                                <div className="text-slate-600 font-medium bg-blue-50 inline-block px-2 py-0.5 rounded text-xs text-blue-700 print:bg-transparent print:p-0 print:text-slate-600">{invoice.targetUnit}</div>
                            )}
                            {invoice.customerPhone && (
                                <div className="text-sm text-slate-500 mt-1">{invoice.customerPhone}</div>
                            )}
                        </div>
                    </div>

                    {/* Table Rincian */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden mb-6 print:mb-3 print:border-slate-800">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-800 text-white print:bg-slate-800 print:text-white">
                                    <th className="py-2.5 px-4 text-left font-bold text-[11px] print:text-[9px] tracking-wide">Rincian Seragam</th>
                                    <th className="py-2.5 px-4 text-center font-bold text-[11px] print:text-[9px] tracking-wide border-l border-slate-700">Qty</th>
                                    <th className="py-2.5 px-4 text-right font-bold text-[11px] print:text-[9px] tracking-wide border-l border-slate-700">Harga Satuan</th>
                                    <th className="py-2.5 px-4 text-right font-bold text-[11px] print:text-[9px] tracking-wide border-l border-slate-700">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoice.items?.map((item, idx) => (
                                    <tr key={idx} className="bg-white border-b border-slate-100 last:border-0 print:border-slate-200">
                                        <td className="py-3 px-4 print:py-2 print:px-3">
                                            <div className="font-bold text-slate-800 text-sm print:text-xs mb-0.5">{item.itemName}</div>
                                            <div className="text-[10px] print:text-[8px] font-bold tracking-widest text-slate-400 uppercase font-mono">Ukuran: {item.size}</div>
                                        </td>
                                        <td className="py-3 px-4 print:py-2 print:px-3 text-center font-black text-slate-700 border-l border-slate-100 print:border-slate-200 bg-slate-50/50 print:text-xs">{item.qty} pcs</td>
                                        <td className="py-3 px-4 print:py-2 print:px-3 text-right text-slate-600 text-sm print:text-xs border-l border-slate-100 print:border-slate-200">Rp {item.unitPrice?.toLocaleString('id-ID')}</td>
                                        <td className="py-3 px-4 print:py-2 print:px-3 text-right font-black text-slate-800 text-sm print:text-xs border-l border-slate-100 print:border-slate-200">Rp {item.totalPrice?.toLocaleString('id-ID')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-end mb-8 print:mb-4">
                        <div className="w-full sm:w-1/2 lg:w-2/5 p-4 print:p-2 bg-slate-50 rounded-xl border border-slate-200 space-y-2 print:bg-transparent print:border-none print:justify-end">
                            <div className="flex justify-between items-center text-sm print:text-[10px] text-slate-500">
                                <span>Subtotal</span>
                                <span className="font-bold text-slate-700">Rp {invoice.subtotal?.toLocaleString('id-ID')}</span>
                            </div>
                            {invoice.discount > 0 && (
                                <div className="flex justify-between items-center text-sm print:text-[10px] text-rose-500">
                                    <span>Diskon</span>
                                    <span className="font-bold">- Rp {invoice.discount?.toLocaleString('id-ID')}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center text-sm print:text-[10px] text-slate-500 pt-2 border-t border-slate-200">
                                <span>Total Telah Dibayar</span>
                                <span className="font-bold text-emerald-600">Rp {invoice.paidAmount?.toLocaleString('id-ID')}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2 mt-2 border-t border-slate-300">
                                <span className="font-black text-slate-800 text-xs print:text-[10px] tracking-wider uppercase">Total Tagihan Akhir</span>
                                <span className="font-black text-blue-700 text-xl print:text-base">Rp {Math.max(0, invoice.totalAmount - invoice.paidAmount).toLocaleString('id-ID')}</span>
                            </div>
                        </div>
                    </div>

                    {/* Footer / Signature */}
                    <div className="flex flex-col-reverse sm:flex-row justify-between items-end pt-4 print:pt-2 border-t border-slate-100 gap-4">
                        <div className="text-[10px] print:text-[8px] font-medium text-slate-400 max-w-[250px] leading-relaxed text-center sm:text-left print:max-w-[200px]">
                            <p>Dokumen ini dicetak dari sistem Manajemen Aset & Logistik Yayasan Dar el-Iman.</p>
                            <p className="mt-1">Untuk verifikasi pembayaran, silakan scan QR Code.</p>
                        </div>
                        <div className="text-center w-full sm:w-auto flex flex-col items-center">
                            <div className="text-[8px] print:text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Tanda Tangan Digital</div>
                            <div className="bg-white p-1.5 print:p-1 inline-block border border-slate-200 rounded-xl shadow-sm relative">
                                <QRCode value={qrData} size={80} level="H" />
                            </div>
                            <div className="text-[10px] print:text-[8px] font-bold text-slate-800 mt-1.5">Sistem SARPRAS</div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default UniformInvoicePublic;
