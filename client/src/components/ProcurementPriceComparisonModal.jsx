import React, { useRef, useState, useEffect } from 'react';
import { X, Printer, Store, CheckCircle2, ShieldCheck, FileSpreadsheet, Award, TrendingDown, Info } from 'lucide-react';
import api from '../lib/axios';

const ProcurementPriceComparisonModal = ({
    isOpen,
    onClose,
    req,
    currentUser = null
}) => {
    const printAreaRef = useRef(null);
    const [fetchedKabidName, setFetchedKabidName] = useState('');
    const [customNotes, setCustomNotes] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        // Ambil nama user yang memiliki position "Kepala Bidang Sarana"
        api.get('/users')
            .then(res => {
                const list = res.data || [];
                const kabidUser = list.find(u =>
                    u.position && u.position.toLowerCase().includes('kepala bidang sarana')
                );
                if (kabidUser) {
                    setFetchedKabidName(kabidUser.name || kabidUser.username);
                }
            })
            .catch(() => {});
    }, [isOpen]);

    if (!isOpen || !req) return null;

    const items = (req.items || []).filter(it => 
        it.needComparison || (it.comparisonVendors && it.comparisonVendors.length > 0)
    );

    // If no specific comparison items, fallback to all items
    const displayItems = items.length > 0 ? items : (req.items || []);

    const formattedDate = new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    const formatCurrency = (val) => {
        if (!val || isNaN(val)) return 'Rp 0';
        return `Rp ${Number(val).toLocaleString('id-ID')}`;
    };

    // Kalkulasi total pagu / estimasi awal dari item yang dibandingkan
    const totalPagu = displayItems.reduce((acc, it) => {
        const p = parseFloat(it.estPrice || it.estimatedPrice || 0) || 0;
        const q = parseFloat(it.qty || it.quantity || 1) || 1;
        return acc + (p * q);
    }, 0);

    // Kalkulasi total penawaran terendah/rekomendasi
    let totalRekomendasi = 0;
    displayItems.forEach(it => {
        const q = parseFloat(it.qty || it.quantity || 1) || 1;
        const vendors = it.comparisonVendors || [];
        const selected = vendors.find(v => v.selected);
        if (selected && parseFloat(selected.price) > 0) {
            totalRekomendasi += q * parseFloat(selected.price);
        } else if (vendors.length > 0) {
            const validPrices = vendors.map(v => parseFloat(v.price) || 0).filter(p => p > 0);
            if (validPrices.length > 0) {
                totalRekomendasi += q * Math.min(...validPrices);
            } else {
                totalRekomendasi += q * (parseFloat(it.estPrice) || 0);
            }
        } else {
            totalRekomendasi += q * (parseFloat(it.estPrice) || 0);
        }
    });

    const totalHemat = totalPagu > totalRekomendasi ? (totalPagu - totalRekomendasi) : 0;
    const persenHemat = totalPagu > 0 ? Math.round((totalHemat / totalPagu) * 100) : 0;

    // Petugas / Surveyor: ambil dari assignee item pertama, atau current user
    const firstAssignedName = displayItems.find(i => i.assignedTo)?.assignedTo;
    const surveyorName = firstAssignedName || currentUser?.name || currentUser?.username || 'Staff Manajemen Aset';
    const kabidName = fetchedKabidName || 'Kepala Bidang Sarana';

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:fixed print:inset-0">
            {/* Embedded Print Styling */}
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    body * {
                        visibility: hidden !important;
                    }
                    #price-comparison-sheet, #price-comparison-sheet * {
                        visibility: visible !important;
                    }
                    #price-comparison-sheet {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        padding: 10mm 15mm !important;
                        margin: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `}} />

            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden border border-slate-200 print:border-none print:shadow-none print:max-h-none print:w-full">
                {/* Header Bar (No Print) */}
                <div className="no-print flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-teal-500/20 text-teal-400 rounded-xl">
                            <Store size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-base text-white">Lembar Perbandingan Harga Vendor</h3>
                            <p className="text-xs text-slate-400">
                                Pengadaan: <span className="font-mono text-teal-300 font-semibold">{req.code || '-'}</span> · {req.title}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95"
                        >
                            <Printer size={15} /> Cetak / PDF
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Document Viewport */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100/70 print:p-0 print:bg-white">
                    <div
                        id="price-comparison-sheet"
                        ref={printAreaRef}
                        className="bg-white mx-auto max-w-[900px] p-6 sm:p-10 rounded-lg shadow-sm print:shadow-none border border-slate-200 print:border-none text-slate-900"
                        style={{ fontFamily: "'Times New Roman', Times, serif", lineHeight: 1.4, fontSize: '11.5pt' }}
                    >
                        {/* KOP RESMI: YAYASAN DAR EL-IMAN PADANG - BIDANG SARANA */}
                        <div className="pb-3 mb-4 border-b-[3px] border-double border-slate-900">
                            <div className="flex items-center justify-between gap-4">
                                <div className="w-20 sm:w-24 flex-shrink-0 text-left">
                                    <img
                                        src="/logo_yayasan.jpg"
                                        alt="Logo Yayasan"
                                        className="h-16 sm:h-20 w-auto object-contain mx-auto"
                                        onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                </div>
                                <div className="flex-1 text-center px-2">
                                    <h4 className="text-sm sm:text-base font-bold tracking-wider text-emerald-800 uppercase font-sans">
                                        YAYASAN DAR EL-IMAN PADANG
                                    </h4>
                                    <h2 className="text-base sm:text-xl font-black tracking-wide text-amber-700 uppercase font-sans mt-0.5">
                                        BIDANG SARANA
                                    </h2>
                                    <p className="text-[10pt] text-slate-600 italic font-serif mt-0.5">
                                        &ldquo;Merawat dengan Ikhlas, Melayani dengan Sunnah&rdquo;
                                    </p>
                                    <p className="text-[8.5pt] text-slate-600 font-sans mt-1 leading-tight">
                                        Komplek Islamic Center, Surau Gadang, Kec. Nanggalo, Kota Padang, Sumatera Barat 25173
                                    </p>
                                    <p className="text-[8pt] text-slate-600 font-sans">
                                        WA: 0895-3202-42508 • Email: dar.el.imansarpras@gmail.com
                                    </p>
                                </div>
                                <div className="w-20 sm:w-24 flex-shrink-0 text-right">
                                    <img
                                        src="/Sarpras.jpeg"
                                        alt="Logo Sarpras"
                                        className="h-16 sm:h-20 w-auto object-contain mx-auto"
                                        onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* JUDUL DOKUMEN */}
                        <div className="text-center mb-5">
                            <h3 className="text-base sm:text-lg font-black uppercase tracking-wide text-slate-950 underline decoration-2 underline-offset-4">
                                LEMBAR PERBANDINGAN HARGA VENDOR
                            </h3>
                            <p className="text-[10pt] text-slate-700 font-sans font-semibold mt-1">
                                Berita Acara Evaluasi &amp; Komparasi Penawaran Harga Pengadaan Barang / Jasa
                            </p>
                            <p className="text-[9.5pt] text-slate-600 font-mono mt-0.5">
                                Nomor Dokumen: BA-PH/{req.code || req.id}/{new Date().getFullYear()}
                            </p>
                        </div>

                        {/* IDENTITAS PENGADAAN */}
                        <div className="mb-4 bg-slate-50/80 p-3.5 rounded border border-slate-300 text-[10.5pt]">
                            <table className="w-full text-slate-800">
                                <tbody>
                                    <tr>
                                        <td className="w-36 font-semibold align-top py-0.5">Kegiatan / Judul</td>
                                        <td className="w-3 align-top py-0.5">:</td>
                                        <td className="font-bold py-0.5">{req.title || '-'}</td>
                                    </tr>
                                    <tr>
                                        <td className="font-semibold align-top py-0.5">Kode Pengadaan</td>
                                        <td className="align-top py-0.5">:</td>
                                        <td className="font-mono font-bold text-slate-900 py-0.5">{req.code || '-'}</td>
                                    </tr>
                                    <tr>
                                        <td className="font-semibold align-top py-0.5">Unit Pemohon</td>
                                        <td className="align-top py-0.5">:</td>
                                        <td className="py-0.5">{req.unit?.name || 'Unit Pemohon'}</td>
                                    </tr>
                                    <tr>
                                        <td className="font-semibold align-top py-0.5">Tanggal Evaluasi</td>
                                        <td className="align-top py-0.5">:</td>
                                        <td className="py-0.5">Padang, {formattedDate}</td>
                                    </tr>
                                    <tr>
                                        <td className="font-semibold align-top py-0.5">Petugas / Surveyor</td>
                                        <td className="align-top py-0.5">:</td>
                                        <td className="py-0.5">{surveyorName}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* DESKRIPSI PENGANTAR */}
                        <p className="mb-3 text-justify text-[10.5pt]">
                            Berdasarkan hasil survei pasar dan permohonan penawaran harga dari beberapa vendor/penyedia terhadap kebutuhan barang/jasa pada unit terkait, berikut rincian komparasi harga dan spesifikasi yang diperoleh:
                        </p>

                        {/* TABEL KOMPARASI PER ITEM & VENDOR */}
                        <div className="mb-4 overflow-x-auto">
                            <table className="w-full border-collapse border border-slate-900 text-[10pt]">
                                <thead>
                                    <tr className="bg-slate-100 text-slate-950 font-bold">
                                        <th className="border border-slate-900 px-2 py-1.5 text-center w-8">No</th>
                                        <th className="border border-slate-900 px-3 py-1.5 text-left">Nama Barang / Spesifikasi</th>
                                        <th className="border border-slate-900 px-2 py-1.5 text-center w-20">Volume</th>
                                        <th className="border border-slate-900 px-2.5 py-1.5 text-right w-28">Estimasi Awal (Pagu)</th>
                                        <th className="border border-slate-900 px-3 py-1.5 text-left">Kandidat Vendor &amp; Penawaran Harga</th>
                                        <th className="border border-slate-900 px-2.5 py-1.5 text-center w-28">Rekomendasi / Termurah</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayItems.map((item, idx) => {
                                        const qty = parseFloat(item.qty || item.quantity || 1) || 1;
                                        const estPrice = parseFloat(item.estPrice || item.estimatedPrice || 0) || 0;
                                        const estSubtotal = qty * estPrice;
                                        const vendors = item.comparisonVendors || [];

                                        // Cari harga terendah di antara vendor
                                        const validPrices = vendors.map(v => parseFloat(v.price) || 0).filter(p => p > 0);
                                        const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : 0;
                                        const selectedVendor = vendors.find(v => v.selected) || vendors.find(v => parseFloat(v.price) === minPrice);

                                        return (
                                            <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50/60' : ''}>
                                                <td className="border border-slate-900 px-2 py-2 text-center align-top font-semibold">
                                                    {idx + 1}
                                                </td>
                                                <td className="border border-slate-900 px-3 py-2 align-top">
                                                    <div className="font-bold text-slate-950">{item.name}</div>
                                                    {item.spec && (
                                                        <div className="text-[9pt] text-slate-600 mt-0.5 whitespace-pre-line italic">
                                                            {item.spec}
                                                        </div>
                                                    )}
                                                    {item.notes && (
                                                        <div className="text-[8.5pt] text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 mt-1 inline-block">
                                                            Catatan: {item.notes}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="border border-slate-900 px-2 py-2 text-center align-top whitespace-nowrap font-medium">
                                                    {qty} {item.unit || 'Unit'}
                                                </td>
                                                <td className="border border-slate-900 px-2.5 py-2 text-right align-top whitespace-nowrap">
                                                    <div className="font-semibold text-slate-900">{formatCurrency(estPrice)}</div>
                                                    <div className="text-[8.5pt] text-slate-500">Total: {formatCurrency(estSubtotal)}</div>
                                                </td>
                                                <td className="border border-slate-900 px-3 py-2 align-top">
                                                    {vendors.length === 0 ? (
                                                        <span className="text-slate-400 italic text-[9.5pt]">— Belum ada kandidat vendor —</span>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            {vendors.map((cv, cIdx) => {
                                                                const cvPrice = parseFloat(cv.price) || 0;
                                                                const cvTotal = qty * cvPrice;
                                                                const isMin = cvPrice > 0 && cvPrice === minPrice;
                                                                const isChosen = cv.selected || (item.vendorName && item.vendorName.toLowerCase() === (cv.name || '').toLowerCase());
                                                                const diff = estPrice - cvPrice;

                                                                return (
                                                                    <div 
                                                                        key={cIdx} 
                                                                        className={`p-2 rounded border text-[9.5pt] ${
                                                                            isChosen 
                                                                                ? 'bg-emerald-50/80 border-emerald-400' 
                                                                                : isMin 
                                                                                    ? 'bg-teal-50/60 border-teal-300' 
                                                                                    : 'bg-white border-slate-200'
                                                                        }`}
                                                                    >
                                                                        <div className="flex items-center justify-between font-bold text-slate-900">
                                                                            <span className="flex items-center gap-1.5">
                                                                                <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[8.5pt] font-mono">
                                                                                    {String.fromCharCode(65 + cIdx)}
                                                                                </span>
                                                                                {cv.name || 'Vendor Tanpa Nama'}
                                                                                {isChosen && (
                                                                                    <span className="text-[7.5pt] bg-emerald-600 text-white font-sans px-1.5 py-0.5 rounded font-bold">
                                                                                        TERPILIH
                                                                                    </span>
                                                                                )}
                                                                                {isMin && !isChosen && (
                                                                                    <span className="text-[7.5pt] bg-teal-600 text-white font-sans px-1.5 py-0.5 rounded font-bold">
                                                                                        TERMURAH
                                                                                    </span>
                                                                                )}
                                                                            </span>
                                                                            <span className="font-mono text-slate-950 font-bold">
                                                                                {formatCurrency(cvPrice)}
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex items-center justify-between text-[8.5pt] text-slate-600 mt-1 pl-6">
                                                                            <span>Subtotal: <strong className="text-slate-800">{formatCurrency(cvTotal)}</strong></span>
                                                                            {diff > 0 ? (
                                                                                <span className="text-emerald-700 font-semibold">
                                                                                    Hemat {formatCurrency(diff)}/unit
                                                                                </span>
                                                                            ) : diff < 0 ? (
                                                                                <span className="text-rose-600">
                                                                                    +{formatCurrency(Math.abs(diff))}/unit
                                                                                </span>
                                                                            ) : null}
                                                                        </div>
                                                                        {(cv.notes || cv.contact) && (
                                                                            <div className="text-[8pt] text-slate-500 italic mt-0.5 pl-6">
                                                                                {cv.notes ? `Ket: ${cv.notes}` : ''}
                                                                                {cv.contact ? ` · Kontak: ${cv.contact}` : ''}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="border border-slate-900 px-2.5 py-2 text-center align-top bg-slate-50/40">
                                                    {selectedVendor ? (
                                                        <div>
                                                            <div className="font-bold text-slate-950 text-[10pt] leading-tight">
                                                                {selectedVendor.name}
                                                            </div>
                                                            <div className="font-mono font-bold text-emerald-800 text-[9.5pt] mt-0.5">
                                                                {formatCurrency(selectedVendor.price)}
                                                            </div>
                                                            <div className="text-[8pt] text-slate-600 mt-1">
                                                                Total: {formatCurrency(qty * (parseFloat(selectedVendor.price) || 0))}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 italic text-[9pt]">-</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-100 font-bold text-[10pt] border-t-2 border-slate-900">
                                        <td colSpan={3} className="border border-slate-900 px-3 py-2 text-right">
                                            Total Biaya Komparasi:
                                        </td>
                                        <td className="border border-slate-900 px-2.5 py-2 text-right font-mono font-bold text-slate-900">
                                            {formatCurrency(totalPagu)}
                                        </td>
                                        <td className="border border-slate-900 px-3 py-2 text-slate-700 text-[9pt]">
                                            Efisiensi Penghematan: <strong className="text-emerald-700 font-bold">{formatCurrency(totalHemat)} ({persenHemat}%)</strong>
                                        </td>
                                        <td className="border border-slate-900 px-2.5 py-2 text-center font-mono font-bold text-emerald-800">
                                            {formatCurrency(totalRekomendasi)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* RINGKASAN REKOMENDASI DAN KESIMPULAN */}
                        <div className="mb-6 p-3.5 rounded border border-slate-300 bg-slate-50 text-[10.5pt] text-justify leading-relaxed">
                            <h4 className="font-bold text-slate-900 mb-1 text-[11pt]">
                                Kesimpulan &amp; Rekomendasi Panitia Pengadaan:
                            </h4>
                            <ol className="list-decimal pl-5 space-y-1 text-slate-800">
                                <li>
                                    Berdasarkan evaluasi terhadap spesifikasi teknis, kelayakan mutu, waktu ketersediaan barang, serta kewajaran harga penawaran, direkomendasikan pengadaan dilaksanakan dengan vendor/penyedia dengan penawaran terbaik dan harga paling efisien.
                                </li>
                                <li>
                                    Total nilai komparasi penawaran yang direkomendasikan adalah sebesar <strong className="font-mono text-slate-950">{formatCurrency(totalRekomendasi)}</strong> dari pagu estimasi awal sebesar <span className="font-mono">{formatCurrency(totalPagu)}</span>, sehingga diperoleh efisiensi anggaran sebesar <strong className="text-emerald-800">{formatCurrency(totalHemat)} ({persenHemat}%)</strong>.
                                </li>
                                {customNotes && (
                                    <li>
                                        <strong>Catatan Khusus:</strong> {customNotes}
                                    </li>
                                )}
                            </ol>
                        </div>

                        {/* PERNYATAAN PENUTUP */}
                        <p className="mb-6 text-justify text-[10.5pt]">
                            Demikian Lembar Perbandingan Harga ini dibuat dengan sebenarnya sesuai dengan data hasil survei lapangan dan penawaran resmi dari penyedia untuk dipergunakan sebagaimana mestinya.
                        </p>

                        {/* PENGESAHAN DOKUMEN (TEPAT 2 PIHAK: PETUGAS/SURVEYOR & KEPALA BIDANG SARANA) */}
                        <div className="pt-2">
                            <div className="grid grid-cols-2 gap-12 text-center text-[11pt]">
                                {/* Pihak 1: Petugas / Surveyor */}
                                <div className="flex flex-col items-center justify-between min-h-[140px]">
                                    <div>
                                        <p className="font-medium">Petugas / Surveyor,</p>
                                        <p className="text-slate-600 text-[9.5pt]">Staf Pengadaan &amp; Aset</p>
                                    </div>
                                    <div className="my-2 flex items-center justify-center h-16 w-full">
                                        <div className="border-b border-dashed border-slate-300 w-36 h-12 flex items-end justify-center text-slate-400 text-[9pt] italic pb-1">
                                            (Tanda Tangan)
                                        </div>
                                    </div>
                                    <div className="w-full">
                                        <p className="font-bold underline text-slate-950">{surveyorName}</p>
                                        <p className="text-slate-600 text-[9pt]">Staff Manajemen Aset</p>
                                    </div>
                                </div>

                                {/* Pihak 2: Kepala Bidang Sarana */}
                                <div className="flex flex-col items-center justify-between min-h-[140px]">
                                    <div>
                                        <p className="font-medium">Mengetahui / Menyetujui,</p>
                                        <p className="text-slate-600 text-[9.5pt]">Kepala Bidang Sarana</p>
                                    </div>
                                    <div className="my-2 flex items-center justify-center h-16 w-full">
                                        <div className="border border-emerald-300 bg-emerald-50/50 rounded px-3 py-1.5 text-center flex flex-col items-center justify-center shadow-xs">
                                            <ShieldCheck size={16} className="text-emerald-600 mb-0.5" />
                                            <span className="text-[8pt] text-emerald-800 font-bold font-sans">TERVERIFIKASI SISTEM</span>
                                            <span className="text-[7pt] text-slate-500 font-mono">TTE KABID SARANA</span>
                                        </div>
                                    </div>
                                    <div className="w-full">
                                        <p className="font-bold underline text-slate-950">{kabidName}</p>
                                        <p className="text-slate-600 text-[9pt]">Kepala Bidang Sarana</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Footer Controls (No Print) */}
                <div className="no-print px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Info size={14} className="text-teal-600" />
                        <span>Kertas dirancang sesuai standar cetak dokumen resmi (A4/Letter).</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                        >
                            <Printer size={14} /> Cetak Lembar Perbandingan
                        </button>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-xl transition-all"
                        >
                            Tutup
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProcurementPriceComparisonModal;
