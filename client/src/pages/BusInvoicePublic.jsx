import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../lib/axios';
import QRCode from 'react-qr-code';
import { Printer, MapPin, Calendar, Users, FileText } from 'lucide-react';

const BusInvoicePublic = () => {
    const { id } = useParams();
    const [invoice, setInvoice] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        // Karena file ini dibuka publik (bisa jadi tanpa token),
        // kita tidak menyertakan Authorization jika memang token belum ada/valid,
        // tapi interceptor axios mungkin sudah menempelkannya (tidak masalah).
        api.get(`/bus-bookings/public/invoice/${id}`)
            .then(res => setInvoice(res.data))
            .catch(err => setError(err.response?.data?.error || 'Invoice tidak ditemukan'))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) return <div className="p-10 text-center font-bold text-slate-500">Memuat Invoice...</div>;
    if (error || !invoice) return <div className="p-10 text-center font-bold text-red-500">{error}</div>;

    const qrData = `INVOICE RESMI YDI\nRef: BUS-${invoice.id}\nLunas: ${new Date(invoice.paidAt).toLocaleDateString('id-ID')}\nNominal: Rp ${invoice.totalBill?.toLocaleString('id-ID')}`;

    return (
        <div className="min-h-screen bg-slate-100 p-4 font-sans print:bg-white print:p-0 print:min-h-0 print:block">
            <style type="text/css" media="print">
                {`
                    @page { size: A5 landscape; margin: 5mm; }
                    body { 
                        -webkit-print-color-adjust: exact; 
                        print-color-adjust: exact;
                        margin: 0;
                        padding: 0;
                    }
                    @media print {
                        .invoice-container {
                            zoom: 0.75; /* Skala dikecilkan agar muat */
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
                                <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">INVOICE PEMBAYARAN</h1>
                            </div>
                            <div className="text-slate-500 font-medium ml-12">Layanan Penyewaan Armada Bus Operasional</div>
                            <div className="mt-6 ml-12 space-y-1 text-sm text-slate-600 border-l-2 border-blue-200 pl-4">
                                <div><span className="font-bold text-slate-800">Yayasan Dar el-Iman</span></div>
                                <div>Bagian Sarana dan Prasarana (Manajemen Aset)</div>
                                <div>Padang, Sumatera Barat</div>
                            </div>
                        </div>
                        <div className="text-left sm:text-right w-full sm:w-auto">
                            <div className="text-xl md:text-2xl font-black text-emerald-600 border-2 border-emerald-600 px-4 py-1.5 inline-block rounded-xl rotate-[-3deg] mb-4 shadow-sm print:text-lg print:mb-2 print:px-3 print:py-1">
                                LUNAS
                            </div>
                            <div className="text-sm print:text-[10px] space-y-1 md:space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-100 print:bg-transparent print:border-none print:p-0 print:space-y-0.5">
                                <div className="flex justify-between gap-6 print:justify-end print:gap-2"><span className="text-slate-400 font-medium">No. Referensi:</span> <span className="font-bold text-slate-800">BUS-{invoice.id}/{new Date(invoice.paidAt).getFullYear()}</span></div>
                                <div className="flex justify-between gap-6 print:justify-end print:gap-2"><span className="text-slate-400 font-medium">Tanggal Bayar:</span> <span className="font-bold text-slate-800">{new Date(invoice.paidAt).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
                            </div>
                        </div>
                    </div>

                    {/* Meta Invoice & Customer */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 print:mb-3">
                        <div className="p-2 print:p-0">
                            <h3 className="text-[10px] print:text-[8px] font-black tracking-widest text-slate-400 uppercase mb-2 print:mb-1">Ditagihkan Kepada :</h3>
                            <div className="font-black text-slate-800 text-lg print:text-base mb-1">{invoice.requesterName}</div>
                            <div className="text-slate-600 font-medium bg-blue-50 inline-block px-2 py-0.5 rounded text-xs text-blue-700 print:bg-transparent print:p-0 print:text-slate-600">{invoice.unit || 'Umum'}</div>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 print:border-none print:bg-transparent print:p-0">
                            <h3 className="text-[10px] print:text-[8px] font-black tracking-widest text-slate-400 uppercase mb-2 print:mb-1">Detail Perjalanan :</h3>
                            <div className="space-y-2 print:space-y-1 text-sm print:text-xs text-slate-700 font-medium">
                                <div className="flex items-start gap-3"><MapPin size={16} className="mt-0.5 text-blue-500 shrink-0"/> <span className="leading-snug">{invoice.destination}</span></div>
                                <div className="flex items-center gap-3"><Calendar size={16} className="text-blue-500 shrink-0"/> <span>{new Date(invoice.startDate).toLocaleDateString('id-ID')} - {new Date(invoice.endDate).toLocaleDateString('id-ID')}</span></div>
                                <div className="flex items-center gap-3"><Users size={16} className="text-blue-500 shrink-0"/> <span>{invoice.passengerCount} Penumpang</span></div>
                            </div>
                        </div>
                    </div>

                    {/* Table Rincian */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden mb-6 print:mb-3 print:border-slate-800">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-800 text-white print:bg-slate-800 print:text-white">
                                    <th className="py-2.5 px-4 text-left font-bold text-[11px] print:text-[9px] tracking-wide">Keterangan Armada</th>
                                    <th className="py-2.5 px-4 text-center font-bold text-[11px] print:text-[9px] tracking-wide border-l border-slate-700 hidden sm:table-cell">Total Jarak</th>
                                    <th className="py-2.5 px-4 text-right font-bold text-[11px] print:text-[9px] tracking-wide border-l border-slate-700">Total Nominal</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="bg-white">
                                    <td className="py-4 px-4 print:py-2 print:px-3">
                                        <div className="font-bold text-slate-800 text-sm print:text-xs mb-0.5">Sewa Armada - {invoice.vehicle?.name}</div>
                                        <div className="text-[10px] print:text-[8px] font-bold tracking-widest text-slate-400 uppercase font-mono">No. Polisi: {invoice.vehicle?.plateNumber}</div>
                                        <div className="text-xs font-bold text-slate-500 mt-1 sm:hidden">{invoice.totalKm} KM</div>
                                    </td>
                                    <td className="py-4 px-4 print:py-2 print:px-3 text-center font-black text-slate-700 border-l border-slate-100 print:border-slate-200 hidden sm:table-cell bg-slate-50/50 print:text-xs">{invoice.totalKm} KM</td>
                                    <td className="py-4 px-4 print:py-2 print:px-3 text-right font-black text-slate-800 text-lg print:text-sm border-l border-slate-100 print:border-slate-200">Rp {invoice.totalBill?.toLocaleString('id-ID')}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-end mb-8 print:mb-4">
                        <div className="w-full sm:w-1/2 p-4 print:p-2 bg-emerald-50 rounded-xl border border-emerald-100 flex justify-between items-center print:bg-transparent print:border-none print:justify-end print:gap-4 lg:w-1/3">
                            <span className="font-black text-emerald-800 text-xs print:text-[10px] tracking-wider uppercase print:text-slate-600">Total Dibayar</span>
                            <span className="font-black text-emerald-600 text-xl print:text-base">Rp {invoice.totalBill?.toLocaleString('id-ID')}</span>
                        </div>
                    </div>

                    {/* Footer / Signature */}
                    <div className="flex flex-col-reverse sm:flex-row justify-between items-end pt-4 print:pt-2 border-t border-slate-100 gap-4">
                        <div className="text-[10px] print:text-[8px] font-medium text-slate-400 max-w-[250px] leading-relaxed text-center sm:text-left print:max-w-[200px]">
                            <p>Dokumen ini ditandatangani secara digital. Silakan scan QR Code untuk memverifikasi keaslian dokumen melalui sistem.</p>
                        </div>
                        <div className="text-center w-full sm:w-auto flex flex-col items-center">
                            <div className="text-[8px] print:text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Tanda Tangan Digital</div>
                            <div className="bg-white p-1.5 print:p-1 inline-block border border-slate-200 rounded-xl shadow-sm relative">
                                <QRCode value={qrData} size={75} />
                                {/* Overlay Logo in the middle of QR */}
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="bg-white p-0.5 rounded border border-slate-100">
                                        <img src="/Sarpras.jpeg" alt="Logo" className="w-4 h-4 object-contain rounded-sm" />
                                    </div>
                                </div>
                            </div>
                            <div className="text-[10px] print:text-[8px] font-bold text-slate-800 mt-1.5">Sistem SARPRAS</div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default BusInvoicePublic;
