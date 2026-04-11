import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../lib/axios';
import QRCode from 'react-qr-code';
import { Printer, MapPin, Calendar, Users, FileText } from 'lucide-react';

const BusInvoiceBatchPrint = () => {
    const [searchParams] = useSearchParams();
    const ids = searchParams.get('ids');
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!ids) {
            setError('Tidak ada ID valid yang disertakan');
            setLoading(false);
            return;
        }

        api.get(`/bus-bookings/public/invoice/batch?ids=${ids}`)
            .then(res => setInvoices(res.data))
            .catch(err => setError(err.response?.data?.error || 'Gagal memuat invoice'))
            .finally(() => setLoading(false));
    }, [ids]);

    if (loading) return <div className="p-10 text-center font-bold text-slate-500">Memuat Invoice Massal...</div>;
    if (error || invoices.length === 0) return <div className="p-10 text-center font-bold text-red-500">{error || 'Invoice tidak ditemukan'}</div>;

    // chunk arrays per 4 items
    const chunkedInvoices = [];
    for (let i = 0; i < invoices.length; i += 4) {
        chunkedInvoices.push(invoices.slice(i, i + 4));
    }

    return (
        <div className="min-h-screen bg-slate-200 p-4 md:p-8 font-sans print:bg-white print:p-0">
            <style type="text/css" media="print">
                {`
                    @page { size: A4 portrait; margin: 10mm; }
                    body { 
                        -webkit-print-color-adjust: exact; 
                        print-color-adjust: exact;
                        margin: 0;
                        padding: 0;
                        background: white;
                    }
                    .page-break { page-break-after: always; }
                    /* Remove shadow and radius strictly on print */
                    .print-normalize { 
                        box-shadow: none !important; 
                        border-radius: 0 !important;
                        border: 1px dashed #ccc !important; /* Help guide cutting */
                    }
                `}
            </style>

            {/* ActionBar */}
            <div className="flex justify-between items-center max-w-[21cm] mx-auto mb-6 print:hidden bg-white p-4 rounded-xl shadow-sm">
                <div className="text-slate-600 font-bold">Cetak Kolektif: {invoices.length} Invoice</div>
                <button 
                    onClick={() => window.print()} 
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg transition-all"
                >
                    <Printer size={18} /> Cetak / Simpan PDF
                </button>
            </div>

            {/* Pages Container */}
            <div className="max-w-[21cm] w-full mx-auto pb-20 print:pb-0">
                {chunkedInvoices.map((pageInvoices, pageIdx) => (
                    <div key={pageIdx} className={`bg-white p-0 shadow-2xl mb-12 print:shadow-none print:mb-0 print:border-none ${pageIdx < chunkedInvoices.length - 1 ? 'page-break' : ''}`}>
                        {/* 2x2 Grid per page */}
                        {/* We use specific mm heights to force 2x2 shape taking up the full A4 space minus margins */}
                        {/* A4 is 297mm height, margin 10mm top/btm = 277mm usable. 277/2 = 138.5mm */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 grid-rows-2 print:h-[277mm] auto-rows-min md:auto-rows-fr w-full box-border">
                            {pageInvoices.map(invoice => {
                                const qrData = `INVOICE RESMI YDI\nRef: BUS-${invoice.id}\nLunas: ${new Date(invoice.paidAt).toLocaleDateString('id-ID')}\nTotal: Rp ${invoice.totalBill?.toLocaleString('id-ID')}`;
                                
                                return (
                                    <div key={invoice.id} className="print-normalize border border-slate-200 p-6 flex flex-col relative print:h-[138.5mm] h-auto overflow-hidden">
                                        
                                        {/* Header */}
                                        <div className="flex justify-between items-center border-b-2 border-slate-100 pb-3 mb-3 print:pb-2 print:mb-2">
                                            <div className="flex items-center gap-2.5">
                                                <div className="bg-blue-600 text-white p-1.5 rounded-lg shrink-0">
                                                    <FileText size={18} className="print:w-4 print:h-4" />
                                                </div>
                                                <div>
                                                    <h1 className="text-xs print:text-[11px] font-black text-slate-800 leading-tight tracking-tight">YAYASAN DAR EL-IMAN</h1>
                                                    <div className="text-[10px] print:text-[8px] text-slate-500 font-medium">Biro Perlengkapan & Aset</div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] font-black text-emerald-600 border border-emerald-600 px-2 py-0.5 rounded rotate-[-4deg] inline-block shadow-sm">LUNAS</div>
                                                <div className="text-[8px] print:text-[7px] text-slate-400 mt-1 font-bold tracking-widest">BUS-{invoice.id}/{new Date(invoice.paidAt).getFullYear()}</div>
                                            </div>
                                        </div>

                                        {/* Customer Meta */}
                                        <div className="mb-3 print:mb-2">
                                            <div className="text-[9px] print:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Ditagihkan Kepada:</div>
                                            <div className="font-black text-slate-800 text-base print:text-sm leading-tight mb-1">{invoice.requesterName}</div>
                                            <div className="text-[11px] print:text-[9px] text-blue-700 bg-blue-50 inline-block px-1.5 rounded font-bold">{invoice.unit || 'Umum'}</div>
                                        </div>

                                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 mb-3 print:mb-2 flex-grow print:p-2">
                                            <div className="space-y-1.5 print:space-y-1 text-xs print:text-[9px] text-slate-700 font-medium">
                                                <div className="flex items-start gap-2 print:gap-1.5"><MapPin size={12} className="mt-0.5 text-blue-500 shrink-0 print:w-2.5 print:h-2.5"/> <span>{invoice.destination}</span></div>
                                                <div className="flex items-center gap-2 print:gap-1.5"><Calendar size={12} className="text-blue-500 shrink-0 print:w-2.5 print:h-2.5"/> <span>{new Date(invoice.startDate).toLocaleDateString('id-ID')}</span></div>
                                                <div className="flex items-center gap-2 print:gap-1.5"><Users size={12} className="text-blue-500 shrink-0 print:w-2.5 print:h-2.5"/> <span>{invoice.passengerCount} Penumpang</span></div>
                                            </div>
                                            <div className="mt-2.5 print:mt-2 border-t border-slate-200 pt-2 print:pt-1.5">
                                                <div className="text-xs print:text-[9px] font-bold text-slate-800 leading-tight">{invoice.vehicle?.name} <span className="font-mono text-slate-500 font-normal">({invoice.vehicle?.plateNumber})</span></div>
                                                <div className="text-[11px] print:text-[8px] text-slate-500 mt-0.5">Total Jarak: <span className="font-bold">{invoice.totalKm} KM</span></div>
                                            </div>
                                        </div>

                                        {/* Bottom section */}
                                        <div className="mt-auto">
                                            <div className="bg-emerald-50 rounded-xl print:rounded-lg p-3 print:p-2.5 flex justify-between items-center border border-emerald-100 mb-3 print:mb-2">
                                                <span className="text-[11px] print:text-[9px] font-black text-emerald-800 uppercase tracking-widest">Total Bayar</span>
                                                <span className="font-black text-emerald-600 text-xl print:text-lg">Rp {invoice.totalBill?.toLocaleString('id-ID')}</span>
                                            </div>

                                            <div className="flex justify-between items-end border-t border-slate-100 pt-2 pb-1">
                                                <div className="text-[9px] print:text-[7px] font-medium text-slate-400 max-w-[150px] leading-relaxed">
                                                    Dokumen ditandatangani digital. Pindai QR Code untuk validasi keaslian.
                                                </div>
                                                <div className="text-center relative flex flex-col items-center">
                                                    <div className="text-[7px] print:text-[6px] font-black text-slate-400 uppercase tracking-widest mb-1">Validasi Sistem</div>
                                                    <div className="bg-white p-1 border border-slate-200 rounded-lg relative shadow-sm">
                                                        <QRCode value={qrData} size={50} />
                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                            <div className="bg-white p-0.5 rounded border border-slate-100">
                                                                <img src="/Sarpras.jpeg" alt="Logo" className="w-[12px] h-[12px] object-contain rounded-sm" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                    </div>
                                );
                            })}

                            {/* Isi slot kosong jika < 4 per halaman untuk menjaga tinggi proporsi */}
                            {Array.from({ length: 4 - pageInvoices.length }).map((_, i) => (
                                <div key={`empty-${i}`} className="border-r border-b border-dashed border-slate-200 p-4 print:h-[138.5mm] hidden sm:block opacity-10 flex items-center justify-center">
                                    <FileText size={48} className="text-slate-300" />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default BusInvoiceBatchPrint;
