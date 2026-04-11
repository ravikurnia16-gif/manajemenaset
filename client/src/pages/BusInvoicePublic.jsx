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
        <div className="min-h-screen bg-slate-100 p-4 font-sans print:bg-white print:p-0 flex flex-col">
            <div className="max-w-3xl w-full mx-auto flex-1">
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
                <div className="bg-white p-8 md:p-12 rounded-[2rem] shadow-xl border border-slate-100 print:shadow-none print:rounded-none print:border-none">
                    
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-100 pb-8 mb-8 gap-6">
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
                            <div className="text-2xl md:text-3xl font-black text-emerald-600 border-2 border-emerald-600 px-6 py-2 inline-block rounded-2xl rotate-[-3deg] mb-6 shadow-sm">
                                LUNAS
                            </div>
                            <div className="text-sm space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <div className="flex justify-between gap-6"><span className="text-slate-400 font-medium">No. Referensi:</span> <span className="font-bold text-slate-800">BUS-{invoice.id}/{new Date(invoice.paidAt).getFullYear()}</span></div>
                                <div className="flex justify-between gap-6"><span className="text-slate-400 font-medium">Tanggal Bayar:</span> <span className="font-bold text-slate-800">{new Date(invoice.paidAt).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
                            </div>
                        </div>
                    </div>

                    {/* Meta Invoice & Customer */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                        <div className="p-4">
                            <h3 className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-3">Ditagihkan Kepada :</h3>
                            <div className="font-black text-slate-800 text-xl mb-1">{invoice.requesterName}</div>
                            <div className="text-slate-600 font-medium bg-blue-50 inline-block px-3 py-1 rounded-lg text-sm text-blue-700">{invoice.unit || 'Umum'}</div>
                        </div>
                        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                            <h3 className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-3">Detail Perjalanan :</h3>
                            <div className="space-y-3 text-sm text-slate-700 font-medium">
                                <div className="flex items-start gap-3"><MapPin size={16} className="mt-0.5 text-blue-500 shrink-0"/> <span className="leading-snug">{invoice.destination}</span></div>
                                <div className="flex items-center gap-3"><Calendar size={16} className="text-blue-500 shrink-0"/> <span>{new Date(invoice.startDate).toLocaleDateString('id-ID')} - {new Date(invoice.endDate).toLocaleDateString('id-ID')}</span></div>
                                <div className="flex items-center gap-3"><Users size={16} className="text-blue-500 shrink-0"/> <span>{invoice.passengerCount} Penumpang</span></div>
                            </div>
                        </div>
                    </div>

                    {/* Table Rincian */}
                    <div className="border border-slate-200 rounded-2xl overflow-hidden mb-8">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-800 text-white">
                                    <th className="py-4 px-6 text-left font-bold text-sm tracking-wide">Keterangan Armada</th>
                                    <th className="py-4 px-6 text-center font-bold text-sm tracking-wide border-l border-slate-700 hidden sm:table-cell">Total Jarak</th>
                                    <th className="py-4 px-6 text-right font-bold text-sm tracking-wide border-l border-slate-700">Total Nominal</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="bg-white">
                                    <td className="py-6 px-6">
                                        <div className="font-bold text-slate-800 text-base mb-1">Sewa Armada - {invoice.vehicle?.name}</div>
                                        <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase font-mono">No. Polisi: {invoice.vehicle?.plateNumber}</div>
                                        <div className="text-sm font-bold text-slate-500 mt-2 sm:hidden">{invoice.totalKm} KM</div>
                                    </td>
                                    <td className="py-6 px-6 text-center font-black text-slate-700 border-l border-slate-100 hidden sm:table-cell bg-slate-50/50">{invoice.totalKm} KM</td>
                                    <td className="py-6 px-6 text-right font-black text-slate-800 text-xl border-l border-slate-100">Rp {invoice.totalBill?.toLocaleString('id-ID')}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-end mb-12">
                        <div className="w-full sm:w-1/2 p-6 bg-emerald-50 rounded-2xl border border-emerald-100 flex justify-between items-center">
                            <span className="font-black text-emerald-800 text-sm tracking-wider uppercase">Total Dibayar</span>
                            <span className="font-black text-emerald-600 text-2xl md:text-3xl">Rp {invoice.totalBill?.toLocaleString('id-ID')}</span>
                        </div>
                    </div>

                    {/* Footer / Signature */}
                    <div className="flex flex-col-reverse sm:flex-row justify-between items-end pt-8 border-t-2 border-slate-100 gap-6">
                        <div className="text-xs font-medium text-slate-400 max-w-[280px] leading-relaxed text-center sm:text-left">
                            <p>Dokumen ini ditandatangani secara digital. Silakan amati/scan QR Code untuk memverifikasi keaslian dokumen ini melalui sistem.</p>
                        </div>
                        <div className="text-center w-full sm:w-auto flex flex-col items-center">
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Tanda Tangan Digital</div>
                            <div className="bg-white p-3 inline-block border-2 border-slate-200 rounded-2xl shadow-sm hover:border-blue-300 transition-colors">
                                <QRCode value={qrData} size={110} />
                            </div>
                            <div className="text-xs font-bold text-slate-800 mt-3">Validasi Sistem SARPRAS</div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default BusInvoicePublic;
