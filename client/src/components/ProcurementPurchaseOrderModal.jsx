import React, { useRef, useState, useEffect } from 'react';
import { X, Printer, FileText, MessageSquare, ShieldCheck, Store, Package, Info, Calendar, Building2, ExternalLink } from 'lucide-react';
import QRCode from 'react-qr-code';
import api from '../lib/axios';

const ProcurementPurchaseOrderModal = ({
    isOpen,
    onClose,
    req,
    currentUser = null,
    kabidName: propKabidName = ''
}) => {
    const printAreaRef = useRef(null);
    const [fetchedKabidName, setFetchedKabidName] = useState(propKabidName || '');
    const [selectedVendorFilter, setSelectedVendorFilter] = useState('ALL');
    const [deliveryDeadline, setDeliveryDeadline] = useState('');
    const [specialNotes, setSpecialNotes] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        if (propKabidName) {
            setFetchedKabidName(propKabidName);
        }
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
    }, [isOpen, propKabidName]);

    if (!isOpen || !req) return null;

    // Filter items: hanya yang dibeli ke vendor (bukan dipenuhi dari gudang internal)
    const externalItems = (req.items || []).filter(i => {
        const isWh = i.vendorId === 'GUDANG' || i.vendorName === 'Bidang Sarana' || i.vendorName === 'Gudang Sarpras (Internal)' || i.vendorName === 'Gudang Sarpras';
        return !isWh && (i.vendorName || i.vendorId);
    });

    // Ambil daftar vendor unik
    const uniqueVendors = [...new Set(externalItems.map(i => i.vendorName).filter(Boolean))];

    // Set default filter jika belum dipilih atau jika hanya ada 1 vendor
    const activeVendor = selectedVendorFilter !== 'ALL' ? selectedVendorFilter : (uniqueVendors[0] || '');

    // Item yang ditampilkan sesuai vendor yang difilter (atau semua jika tidak ada vendor khusus)
    const displayItems = selectedVendorFilter === 'ALL'
        ? externalItems
        : externalItems.filter(i => i.vendorName === selectedVendorFilter);

    const formattedDate = new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    const formatCurrency = (val) => {
        if (!val || isNaN(val)) return 'Rp 0';
        return `Rp ${Number(val).toLocaleString('id-ID')}`;
    };

    const totalPoAmount = displayItems.reduce((acc, it) => {
        const p = parseFloat(it.finalPrice || it.estPrice || 0) || 0;
        const q = parseFloat(it.qty || it.quantity || 1) || 1;
        return acc + (p * q);
    }, 0);

    const kabidName = fetchedKabidName || propKabidName || 'Kepala Bidang Sarana';

    // Cari kontak vendor dari comparisonVendors jika ada
    let vendorContact = '';
    for (const it of displayItems) {
        const matched = (it.comparisonVendors || []).find(cv => cv.name === (activeVendor || it.vendorName));
        if (matched?.contact) {
            vendorContact = matched.contact;
            break;
        }
    }

    const poNumber = `PO/SRN/${req.code || req.id}/${new Date().getFullYear()}`;
    const qrVerifyUrl = `https://sarpras.dareliman.or.id/verify-doc?type=PURCHASE_ORDER&no=${encodeURIComponent(poNumber)}&kabid=${encodeURIComponent(kabidName)}`;

    const handlePrint = () => {
        window.print();
    };

    const handleSendWA = () => {
        const cleanPhone = (vendorContact || '').replace(/\D/g, '');
        const targetPhone = cleanPhone.startsWith('0') ? `62${cleanPhone.slice(1)}` : cleanPhone;

        const itemsList = displayItems.map((it, idx) => {
            const q = it.qty || 1;
            const p = it.finalPrice || it.estPrice || 0;
            return `${idx + 1}. *${it.name}* ${it.brand ? `(${it.brand})` : ''} - ${q} ${it.unit || 'unit'} @ ${formatCurrency(p)} = ${formatCurrency(q * p)}`;
        }).join('\n');

        const message = `*SURAT PESANAN RESMI (PURCHASE ORDER)*\n*Yayasan Dar el-Iman Padang - Bidang Sarana*\n\n` +
            `Nomor PO: *${poNumber}*\n` +
            `Tanggal: ${formattedDate}\n` +
            `Kepada Yth: *${selectedVendorFilter !== 'ALL' ? selectedVendorFilter : (uniqueVendors.join(', ') || 'Penyedia Rekanan')}*\n` +
            `Untuk Keperluan: *${req.title || '-'} (${req.unit?.name || 'Unit'})*\n` +
            (deliveryDeadline ? `Batas Waktu Pengiriman: *${new Date(deliveryDeadline).toLocaleDateString('id-ID')}*\n` : '') +
            `\n*Daftar Barang yang Dipesan:*\n${itemsList}\n\n` +
            `*Total Nilai Pemesanan:* *${formatCurrency(totalPoAmount)}*\n` +
            (specialNotes ? `\n*Catatan Pemesanan:*\n${specialNotes}\n` : '') +
            `\nSurat Pesanan ini diterbitkan secara sah oleh Bidang Sarana Yayasan Dar el-Iman. Mohon konfirmasi kesiapan barang dan pengiriman. Terima kasih.`;

        const waUrl = targetPhone ? `https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}` : `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(waUrl, '_blank');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:fixed print:inset-0">
            {/* Embedded Print Styling - Optimized for 1-page A4 */}
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 8mm 12mm 8mm 12mm;
                    }
                    html, body {
                        width: 210mm !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #ffffff !important;
                    }
                    body * {
                        visibility: hidden !important;
                    }
                    #purchase-order-sheet, #purchase-order-sheet * {
                        visibility: visible !important;
                    }
                    #purchase-order-sheet {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                        page-break-inside: avoid !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `}} />

            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden border border-slate-200 print:border-none print:shadow-none print:max-h-none print:w-full">
                {/* Header Bar (No Print) */}
                <div className="no-print flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-xl">
                            <FileText size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-base text-white">Surat Pesanan (Purchase Order / PO)</h3>
                            <p className="text-xs text-slate-400">
                                No: <span className="font-mono text-blue-300 font-semibold">{poNumber}</span> · Pengadaan: {req.code}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {uniqueVendors.length > 1 && (
                            <div className="flex items-center gap-1 text-xs mr-2">
                                <span className="text-slate-400">Vendor:</span>
                                <select
                                    value={selectedVendorFilter}
                                    onChange={e => setSelectedVendorFilter(e.target.value)}
                                    className="bg-slate-800 text-white text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 outline-none"
                                >
                                    <option value="ALL">Semua Vendor ({externalItems.length} item)</option>
                                    {uniqueVendors.map(v => (
                                        <option key={v} value={v}>{v}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <button
                            onClick={handleSendWA}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95"
                            title="Bagikan PO ke WhatsApp Vendor"
                        >
                            <MessageSquare size={15} /> WhatsApp
                        </button>
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95"
                        >
                            <Printer size={15} /> Cetak PO
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
                        id="purchase-order-sheet"
                        ref={printAreaRef}
                        className="bg-white mx-auto max-w-[800px] p-6 sm:p-8 rounded-lg shadow-sm print:shadow-none border border-slate-200 print:border-none text-slate-900 print:p-0"
                        style={{ fontFamily: "'Times New Roman', Times, serif", lineHeight: 1.35, fontSize: '10pt' }}
                    >
                        {/* KOP RESMI: YAYASAN DAR EL-IMAN PADANG - BIDANG SARANA */}
                        <div className="pb-2.5 mb-3 border-b-[2.5px] border-double border-slate-900">
                            <div className="flex items-center justify-between gap-3">
                                <div className="w-18 sm:w-20 flex-shrink-0 text-left">
                                    <img
                                        src="/logo_yayasan.jpg"
                                        alt="Logo Yayasan"
                                        className="h-14 sm:h-16 w-auto object-contain mx-auto"
                                        onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                </div>
                                <div className="flex-1 text-center px-1">
                                    <h4 className="text-sm sm:text-base font-bold tracking-wider text-emerald-800 uppercase font-sans">
                                        YAYASAN DAR EL-IMAN
                                    </h4>
                                    <h2 className="text-lg sm:text-xl font-black tracking-wide text-amber-700 uppercase font-sans mt-0.5">
                                        BIDANG SARANA
                                    </h2>
                                    <p className="text-[9pt] text-slate-600 italic font-serif mt-0.5">
                                        &ldquo;Merawat dengan Ikhlas, Melayani dengan Sunnah&rdquo;
                                    </p>
                                    <p className="text-[8pt] text-slate-600 font-sans mt-0.5 leading-tight">
                                        Komplek Islamic Center, Surau Gadang, Kec. Nanggalo, Kota Padang, Sumatera Barat 25173
                                    </p>
                                    <p className="text-[7.5pt] text-slate-600 font-sans">
                                        WA: 0895-3202-42508 • Email: dar.el.imansarpras@gmail.com
                                    </p>
                                </div>
                                <div className="w-18 sm:w-20 flex-shrink-0 text-right">
                                    <img
                                        src="/Sarpras.jpeg"
                                        alt="Logo Sarpras"
                                        className="h-14 sm:h-16 w-auto object-contain mx-auto"
                                        onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* JUDUL SURAT PESANAN */}
                        <div className="text-center mb-3">
                            <h3 className="text-base sm:text-lg font-black uppercase tracking-wide text-slate-950 underline decoration-2 underline-offset-4">
                                SURAT PESANAN RESMI (PURCHASE ORDER)
                            </h3>
                            <p className="text-[9.5pt] text-slate-700 font-mono mt-0.5 font-bold">
                                Nomor: {poNumber}
                            </p>
                        </div>

                        {/* INFORMASI VENDOR & PENGADAAN */}
                        <div className="mb-3 flex flex-col sm:flex-row justify-between gap-3 text-[9.5pt]">
                            {/* Kepada Yth: Vendor */}
                            <div className="flex-1 p-2.5 rounded border border-slate-300 bg-slate-50/70">
                                <span className="text-[8.5pt] uppercase tracking-wider font-bold text-slate-600 font-sans block mb-0.5">
                                    Ditujukan Kepada Penyedia / Vendor:
                                </span>
                                <div className="font-bold text-slate-950 text-[10.5pt]">
                                    {selectedVendorFilter !== 'ALL' ? selectedVendorFilter : (uniqueVendors.join(', ') || 'Penyedia Rekanan')}
                                </div>
                                {vendorContact && (
                                    <div className="text-slate-600 text-[9pt] mt-0.5">
                                        Kontak: {vendorContact}
                                    </div>
                                )}
                                <div className="text-slate-500 text-[8.5pt] italic mt-0.5">
                                    Tempat / Di Lokasi
                                </div>
                            </div>

                            {/* Data Pemesan */}
                            <div className="flex-1 p-2.5 rounded border border-slate-300 bg-slate-50/70">
                                <span className="text-[8.5pt] uppercase tracking-wider font-bold text-slate-600 font-sans block mb-0.5">
                                    Identitas Pemesan:
                                </span>
                                <table className="text-slate-800 text-[9pt]">
                                    <tbody>
                                        <tr>
                                            <td className="pr-2 font-semibold">Unit Kebutuhan</td>
                                            <td className="pr-1">:</td>
                                            <td>{req.unit?.name || 'Unit Pemohon'}</td>
                                        </tr>
                                        <tr>
                                            <td className="pr-2 font-semibold">Perihal / Judul</td>
                                            <td className="pr-1">:</td>
                                            <td className="font-medium">{req.title}</td>
                                        </tr>
                                        <tr>
                                            <td className="pr-2 font-semibold">Tanggal Pemesanan</td>
                                            <td className="pr-1">:</td>
                                            <td>Padang, {formattedDate}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* DESKRIPSI PENGANTAR */}
                        <p className="mb-2 text-justify text-[9.5pt] leading-normal">
                            Dengan hormat, sehubungan dengan hasil evaluasi pengadaan barang/jasa, bersama surat ini kami sampaikan pemesanan barang/jasa dengan rincian kebutuhan sebagai berikut:
                        </p>

                        {/* TABEL RINCIAN PESANAN */}
                        <div className="mb-3 overflow-x-auto">
                            <table className="w-full border-collapse border border-slate-900 text-[9pt]">
                                <thead>
                                    <tr className="bg-slate-100 text-slate-950 font-bold">
                                        <th className="border border-slate-900 px-2 py-1 text-center w-8">No</th>
                                        <th className="border border-slate-900 px-2.5 py-1 text-left">Nama Barang / Deskripsi</th>
                                        <th className="border border-slate-900 px-2 py-1 text-center w-24">Merk / Brand</th>
                                        <th className="border border-slate-900 px-2 py-1 text-center w-20">Volume</th>
                                        <th className="border border-slate-900 px-2.5 py-1 text-right w-28">Harga Satuan</th>
                                        <th className="border border-slate-900 px-2.5 py-1 text-right w-32">Total Harga</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="border border-slate-900 px-3 py-3 text-center italic text-slate-500">
                                                Belum ada barang yang difinalisasi ke vendor eksternal.
                                            </td>
                                        </tr>
                                    ) : (
                                        displayItems.map((item, idx) => {
                                            const qty = parseFloat(item.qty || item.quantity || 1) || 1;
                                            const price = parseFloat(item.finalPrice || item.estPrice || 0) || 0;
                                            const subtotal = qty * price;

                                            return (
                                                <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50/60' : ''}>
                                                    <td className="border border-slate-900 px-2 py-1 text-center align-top font-semibold">
                                                        {idx + 1}
                                                    </td>
                                                    <td className="border border-slate-900 px-2.5 py-1 align-top">
                                                        <div className="font-bold text-slate-950">{item.name}</div>
                                                        {item.spec && (
                                                            <div className="text-[8pt] text-slate-600 mt-0.5 whitespace-pre-line italic">
                                                                {item.spec}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="border border-slate-900 px-2 py-1 text-center align-top font-medium">
                                                        {item.brand || '—'}
                                                    </td>
                                                    <td className="border border-slate-900 px-2 py-1 text-center align-top whitespace-nowrap font-medium">
                                                        {qty} {item.unit || 'Unit'}
                                                    </td>
                                                    <td className="border border-slate-900 px-2.5 py-1 text-right align-top whitespace-nowrap font-mono">
                                                        {formatCurrency(price)}
                                                    </td>
                                                    <td className="border border-slate-900 px-2.5 py-1 text-right align-top whitespace-nowrap font-mono font-bold text-slate-950">
                                                        {formatCurrency(subtotal)}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-100 font-bold text-[9.5pt] border-t-2 border-slate-900">
                                        <td colSpan={5} className="border border-slate-900 px-2.5 py-1.5 text-right">
                                            Total Nilai Pemesanan:
                                        </td>
                                        <td className="border border-slate-900 px-2.5 py-1.5 text-right font-mono font-bold text-slate-950">
                                            {formatCurrency(totalPoAmount)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* SYARAT & KETENTUAN PESANAN */}
                        <div className="mb-3 p-2.5 rounded border border-slate-300 bg-slate-50 text-[9pt] leading-relaxed">
                            <span className="font-bold block text-slate-900 mb-0.5">Syarat &amp; Ketentuan Pemesanan:</span>
                            <ol className="list-decimal pl-5 space-y-0.5 text-slate-700">
                                <li>Barang yang dikirim harus dalam keadaan 100% baru, berkualitas baik, dan sesuai dengan spesifikasi/merk yang tertera.</li>
                                <li>Pengiriman disertai dengan Faktur / Nota Pembelian resmi dan Surat Jalan.</li>
                                <li>Pembayaran diproses setelah barang diterima dan diverifikasi kelengkapannya oleh tim Sarpras Yayasan Dar El-Iman.</li>
                                {deliveryDeadline && (
                                    <li><strong>Batas Waktu Pengiriman:</strong> Maksimal tanggal {new Date(deliveryDeadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}.</li>
                                )}
                                {specialNotes && (
                                    <li><strong>Instruksi Khusus:</strong> {specialNotes}</li>
                                )}
                            </ol>
                        </div>

                        {/* PERNYATAAN PENUTUP */}
                        <p className="mb-3 text-justify text-[9.5pt] leading-normal">
                            Demikian Surat Pesanan ini kami sampaikan untuk dapat ditindaklanjuti. Atas perhatian dan kerjasamanya kami ucapkan terima kasih.
                        </p>

                        {/* TANDA TANGAN RESMI: KEPALA BIDANG SARANA (TTE ELEKTRONIK DENGAN QR CODE & LOGO) */}
                        <div className="pt-2 flex justify-end" style={{ pageBreakInside: 'avoid' }}>
                            <div className="w-64 text-center flex flex-col items-center">
                                <div>
                                    <p className="text-[9.5pt] font-medium text-slate-800">Hormat Kami,</p>
                                    <p className="text-[10pt] font-bold text-slate-950 mt-0.5">Kepala Bidang Sarana</p>
                                </div>

                                {/* QR Code TTE dengan Logo Bidang Sarana di tengah */}
                                <div className="my-2 flex flex-col items-center justify-center">
                                    <div className="relative p-1.5 bg-white border border-emerald-400 rounded-lg shadow-xs flex items-center justify-center">
                                        <QRCode
                                            value={qrVerifyUrl}
                                            size={68}
                                            level="H"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <div className="bg-white p-0.5 rounded border border-slate-200 shadow-xs flex items-center justify-center">
                                                <img
                                                    src="/Sarpras.jpeg"
                                                    alt="Logo Bidang Sarana"
                                                    className="w-4 h-4 object-contain rounded-xs"
                                                    onError={(e) => { e.target.src = '/logo_yayasan.jpg'; }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 text-emerald-700 font-bold text-[7.5pt] font-sans mt-1">
                                        <ShieldCheck size={12} className="text-emerald-600 flex-shrink-0" />
                                        <span>DITANDATANGANI ELEKTRONIK (TTE)</span>
                                    </div>
                                    <span className="text-[6.5pt] text-slate-500 font-mono leading-tight">
                                        TTE SAH KEPALA BIDANG SARANA
                                    </span>
                                </div>

                                <div className="w-full">
                                    <p className="font-bold underline text-slate-950 text-[10pt]">{kabidName}</p>
                                    <p className="text-slate-600 text-[8.5pt]">Kepala Bidang Sarana dan Prasarana</p>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Footer Controls (No Print) */}
                <div className="no-print px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
                    <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap">
                        <div className="flex items-center gap-1.5">
                            <Calendar size={14} className="text-blue-600" />
                            <span>Deadline:</span>
                            <input
                                type="date"
                                value={deliveryDeadline}
                                onChange={e => setDeliveryDeadline(e.target.value)}
                                className="border border-slate-300 rounded px-2 py-0.5 text-xs bg-white"
                            />
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span>Catatan PO:</span>
                            <input
                                type="text"
                                placeholder="misal: dikirim sebelum jam 15.00"
                                value={specialNotes}
                                onChange={e => setSpecialNotes(e.target.value)}
                                className="border border-slate-300 rounded px-2 py-0.5 text-xs bg-white w-48"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleSendWA}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                        >
                            <MessageSquare size={14} /> Kirim WhatsApp
                        </button>
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                        >
                            <Printer size={14} /> Cetak PO
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

export default ProcurementPurchaseOrderModal;

