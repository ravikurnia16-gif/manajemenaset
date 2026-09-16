import React from 'react';
import { 
    Printer, 
    ExternalLink, 
    MessageSquare, 
    CheckCircle2, 
    ShieldCheck, 
    PackageCheck, 
    X, 
    FileText 
} from 'lucide-react';
import QRCode from 'react-qr-code';

export const ProjectBASTModal = ({ 
    isOpen, 
    onClose, 
    project 
}) => {
    if (!isOpen || !project) return null;

    const items = project.projectItems || [];
    const bastNumber = project.bastNumber || 'DRAFT/BAST/SRN';
    const bastDate = project.bastDate ? new Date(project.bastDate) : new Date();

    const handlePrint = () => {
        window.print();
    };

    const handleOpenEOffice = () => {
        window.open('/e-office', '_blank');
    };

    const handleSendWA = () => {
        const phone = (project.poVendorPhone || '').replace(/\D/g, '');
        const targetPhone = phone.startsWith('0') ? `62${phone.slice(1)}` : phone;

        const itemsList = items.map((it, idx) => 
            `${idx + 1}. ${it.item?.name || it.variant?.item?.name || it.name || 'Barang'} - Diterima: ${it.receivedQuantity || it.quantity} ${it.item?.unit || it.unit || 'Pcs'} [Kondisi: Baik]`
        ).join('\n');

        const message = `*BERITA ACARA SERAH TERIMA (BAST) GUDANG*\n*Yayasan Dar el-Iman Padang*\n\n` +
            `Nomor BAST: *${bastNumber}*\n` +
            `Proyek: *${project.title || project.name}*\n` +
            `Penyedia / Vendor: *${project.poVendorName || 'Vendor Rekanan'}*\n` +
            `Tanggal Diterima: *${bastDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}*\n\n` +
            `*Hasil Pemeriksaan Cek Fisik Barang:*\n${itemsList}\n\n` +
            `Status Penerimaan: *LENGKAP & BAIK*\n` +
            `Dokumen BAST ini sah dan telah teregistrasi secara digital di sistem E-Office Yayasan Dar el-Iman.`;

        const waUrl = `https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}`;
        window.open(waUrl, '_blank');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
                {/* Header Modal */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                            <PackageCheck size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 text-base">Berita Acara Serah Terima (BAST) Gudang</h3>
                            <p className="text-xs text-slate-500">Lembar Cek Fisik & Serah Terima Resmi Terhubung E-Office</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            type="button" 
                            onClick={handleSendWA} 
                            className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors"
                        >
                            <MessageSquare size={14} /> WhatsApp
                        </button>
                        <button 
                            type="button" 
                            onClick={handleOpenEOffice} 
                            className="text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors"
                        >
                            <ExternalLink size={14} /> E-Office
                        </button>
                        <button 
                            type="button" 
                            onClick={handlePrint} 
                            className="text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors"
                        >
                            <Printer size={14} /> Cetak BAST
                        </button>
                        <button 
                            onClick={onClose} 
                            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Printable Content Area */}
                <div className="p-6 max-h-[78vh] overflow-y-auto space-y-6 text-xs text-slate-800 print:max-h-none print:p-0">
                    {/* Kop Surat Resmi */}
                    <div className="border-b-2 border-slate-800 pb-3 text-center">
                        <h2 className="font-extrabold text-slate-900 text-lg tracking-wide uppercase">
                            YAYASAN DAR EL-IMAN PADANG
                        </h2>
                        <h4 className="font-bold text-slate-700 text-xs sm:text-sm uppercase tracking-wider">
                            BIDANG SARANA DAN PRASARANA - GUDANG LOGISTIK
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            Jl. Gajah Mada No. 1, Kota Padang, Sumatera Barat • Telp / Hotline Sarpras: 0812-3456-7890
                        </p>
                    </div>

                    {/* Judul & Nomor BAST */}
                    <div className="text-center space-y-1">
                        <h3 className="text-base font-black uppercase tracking-wider text-slate-900 underline">
                            BERITA ACARA SERAH TERIMA BARANG (BAST)
                        </h3>
                        <p className="font-mono font-bold text-slate-700 text-xs">
                            Nomor: {bastNumber}
                        </p>
                        {project.poNumber && (
                            <p className="text-[11px] text-slate-500">
                                Berdasarkan Surat Pesanan (PO) No: <b className="text-slate-700 font-mono">{project.poNumber}</b>
                            </p>
                        )}
                    </div>

                    {/* Narasi Serah Terima */}
                    <p className="leading-relaxed">
                        Pada hari ini, tanggal <b>{bastDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</b>, 
                        bertempat di Gudang Sarana Yayasan Dar el-Iman Padang, telah dilaksanakan serah terima hasil pengadaan barang dengan rincian para pihak sebagai berikut:
                    </p>

                    {/* Para Pihak */}
                    <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                        <div>
                            <span className="font-bold text-slate-500 uppercase text-[10px] block mb-1">PIHAK PERTAMA (Yang Menyerahkan):</span>
                            <p className="font-black text-slate-900 text-sm">{project.poVendorName || 'Pihak Penyedia / Rekanan'}</p>
                            <p className="text-slate-600 mt-0.5">Selaku Penyedia Barang / Rekanan Pengadaan</p>
                            <p className="text-slate-600 mt-0.5">Alamat: {project.poVendorAddress || '-'}</p>
                        </div>
                        <div>
                            <span className="font-bold text-slate-500 uppercase text-[10px] block mb-1">PIHAK KEDUA (Yang Menerima):</span>
                            <p className="font-black text-slate-900 text-sm">Bagian Gudang Sarana & Prasarana</p>
                            <p className="text-slate-600 mt-0.5">Yayasan Dar el-Iman Padang</p>
                            <p className="text-slate-600 mt-0.5">Lokasi Penerimaan: Gudang Logistik / Seragam Dar el-Iman</p>
                        </div>
                    </div>

                    <p className="leading-relaxed">
                        Kedua belah pihak telah melakukan <b>Pemeriksaan Cek Fisik Barang</b> secara seksama terhadap kuantitas, spesifikasi, dan kelayakan mutu barang sebagai berikut:
                    </p>

                    {/* Tabel Lembar Cek Fisik Barang */}
                    <div className="border border-slate-300 rounded-lg overflow-hidden">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-100 font-bold text-slate-700 border-b border-slate-300">
                                <tr>
                                    <th className="p-2.5 w-10 text-center">No</th>
                                    <th className="p-2.5">Nama Barang & Spesifikasi</th>
                                    <th className="p-2.5 text-center">Pesanan (PO)</th>
                                    <th className="p-2.5 text-center">Diterima Fisik</th>
                                    <th className="p-2.5 text-center">Satuan</th>
                                    <th className="p-2.5 text-center">Hasil Cek Kondisi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {items.map((it, idx) => (
                                    <tr key={it.id || idx}>
                                        <td className="p-2.5 text-center font-medium text-slate-500">{idx + 1}</td>
                                        <td className="p-2.5 font-bold text-slate-900">
                                            {it.item?.name || it.variant?.item?.name || it.name || 'Barang'}
                                            {it.variant?.sizeName && (
                                                <span className="ml-2 font-normal text-slate-600">
                                                    (Ukuran: {it.variant.sizeName})
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-2.5 text-center text-slate-600">{it.quantity}</td>
                                        <td className="p-2.5 text-center font-black text-blue-700">
                                            {it.receivedQuantity || it.quantity}
                                        </td>
                                        <td className="p-2.5 text-center text-slate-700">{it.item?.unit || it.unit || 'Pcs'}</td>
                                        <td className="p-2.5 text-center">
                                            <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 text-[10px]">
                                                <CheckCircle2 size={12} /> Baik & Lengkap
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pernyataan Penutup */}
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-[11px] text-slate-600 space-y-1 leading-relaxed">
                        <p className="font-bold text-slate-800">Catatan Pemeriksaan Gudang:</p>
                        <p>
                            Berdasarkan hasil pemeriksaan fisik di atas, barang-barang tersebut telah diterima dalam keadaan baik, lengkap, dan memenuhi standar yang ditentukan.
                            Demikian Berita Acara Serah Terima (BAST) ini dibuat dalam keadaan sadar untuk dipergunakan sebagaimana mestinya.
                        </p>
                    </div>

                    {/* Tanda Tangan Para Pihak & Pengesahan Kabid Sarana */}
                    <div className="pt-4 grid grid-cols-3 gap-4 items-end text-center">
                        <div className="space-y-1">
                            <p className="text-[11px] text-slate-500">Pihak Pertama (Penyedia),</p>
                            <p className="font-bold text-slate-800 text-xs">{project.poVendorName || 'Pihak Rekanan'}</p>
                            <div className="h-16 flex items-center justify-center text-slate-400 italic text-[10px]">
                                (Tanda Tangan & Cap)
                            </div>
                            <p className="font-bold text-slate-900 underline uppercase text-xs">Pimpinan / Perwakilan</p>
                        </div>

                        <div className="space-y-1">
                            <p className="text-[11px] text-slate-500">Pihak Kedua (Penerima),</p>
                            <p className="font-bold text-slate-800 text-xs">Staff Gudang Sarana</p>
                            <div className="h-16 flex items-center justify-center text-slate-400 italic text-[10px]">
                                (Tercatat Sistem Gudang)
                            </div>
                            <p className="font-bold text-slate-900 underline uppercase text-xs">Pengelola Gudang</p>
                        </div>

                        <div className="space-y-1 flex flex-col items-center">
                            <p className="text-[11px] text-slate-500">Mengetahui & Menyetujui,</p>
                            <p className="font-bold text-blue-900 text-xs">Kepala Bidang Sarana</p>
                            
                            <div className="py-1">
                                <div className="p-1 bg-white border border-slate-300 rounded-lg shadow-2xs inline-block">
                                    <QRCode 
                                        value={`https://eoffice.dareliman.or.id/verify/${bastNumber}`} 
                                        size={50} 
                                        level="M"
                                    />
                                </div>
                                <p className="text-[9px] text-emerald-700 font-bold mt-0.5">TTE E-OFFICE</p>
                            </div>

                            <p className="font-bold text-slate-900 underline uppercase text-xs">
                                {project.approvedByName || 'Ravi Kurnia, S.Pd.I'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer Modal */}
                <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-between items-center text-xs text-slate-500 print:hidden">
                    <span className="font-mono text-[11px]">
                        BAST: {bastNumber} • Terkoneksi Resmi dengan Modul E-Office
                    </span>
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="px-4 py-1.5 rounded-xl font-bold bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors"
                    >
                        Tutup
                    </button>
                </div>
            </div>
        </div>
    );
};
