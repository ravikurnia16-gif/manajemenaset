import React, { useRef, useState } from 'react';
import { X, Printer, CheckCircle2, ShieldCheck, Clock, FileText, AlertCircle, PenTool, ExternalLink, Send } from 'lucide-react';
import api from '../lib/axios';
import SignaturePad from './SignaturePad';

const ProcurementAssignmentOrderModal = ({
    isOpen,
    onClose,
    order,
    currentUser,
    onOrderUpdated = null
}) => {
    const printAreaRef = useRef(null);
    const [showSignPad, setShowSignPad] = useState(false);
    const [signing, setSigning] = useState(false);
    const [notifying, setNotifying] = useState(false);

    if (!isOpen || !order) return null;

    const {
        orderId,
        orderNumber = '-',
        uuid: docUuid,
        procurementCode = '-',
        procurementTitle = 'Pengadaan Barang / Jasa',
        unitName = 'Unit Pemohon',
        createdAt = new Date(),
        assigner = {},
        assignee = {},
        items: assignedItems = [],
        notes = '',
        assignerTte = true,
        assignerTteAt = null,
        qrCodeData = null,
        verifyUrl = null,
        assigneeSignature = null,
        assigneeSignedAt = null,
        officeDocumentId = null
    } = order;

    // Resolusi nama dan jabatan Kepala Bidang Sarana & Petugas
    const assignerName = (assigner?.name && assigner.name !== 'Pemberi Tugas')
        ? assigner.name
        : (assigner?.username || '');
    const assignerPosition = assigner?.position || 'Kepala Bidang Sarana';
    const assignerNiy = assigner?.nip || assigner?.niy || '-';
    const assigneeNiy = assignee?.nip || assignee?.niy || '-';

    const formattedDate = new Date(createdAt).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    const formatCurrency = (val) => {
        if (!val || isNaN(val)) return 'Rp 0';
        return `Rp ${Number(val).toLocaleString('id-ID')}`;
    };

    const totalEstimate = (assignedItems || []).reduce((acc, it) => {
        const p = parseFloat(it.estPrice || it.estimatedPrice || it.price || 0) || 0;
        const q = parseFloat(it.qty || it.quantity || 1) || 1;
        return acc + (p * q);
    }, 0);

    // Izinkan tanda tangan langsung di halaman/modal ini
    const canSign = !assigneeSignature;

    const handlePrint = async () => {
        // 1. Langsung panggil cetak browser
        window.print();

        // 2. Otomatis kirim notifikasi WhatsApp ke petugas yang ditugaskan
        try {
            setNotifying(true);
            await api.post(`/procurements/${order.procurementId}/assignment-orders/${order.orderId}/notify-print`);
        } catch (err) {
            console.error('Error sending print notification:', err);
        } finally {
            setNotifying(false);
        }
    };

    const handleManualNotify = async () => {
        try {
            setNotifying(true);
            const res = await api.post(`/procurements/${order.procurementId}/assignment-orders/${order.orderId}/notify-print`);
            alert(res.data?.message || 'Pemberitahuan WhatsApp berhasil dikirim ke petugas.');
        } catch (err) {
            console.error('Manual notify error:', err);
            alert(err.response?.data?.error || 'Gagal mengirim pemberitahuan WhatsApp.');
        } finally {
            setNotifying(false);
        }
    };

    const handleSaveSignature = async (sigDataUrl) => {
        if (!sigDataUrl) return;
        setSigning(true);
        try {
            const res = await api.post(`/procurements/${order.procurementId}/assignment-orders/sign`, {
                orderId: order.orderId,
                signature: sigDataUrl
            });
            setShowSignPad(false);
            if (onOrderUpdated && res.data?.order) {
                onOrderUpdated(res.data.order);
            }
            alert('Surat Perintah Pengadaan berhasil ditandatangani.');
        } catch (err) {
            console.error('Sign order error:', err);
            alert(err.response?.data?.error || 'Gagal menandatangani Surat Perintah.');
        } finally {
            setSigning(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:fixed print:inset-0">
            {/* Embedded Print Styling - A4 Single Page Optimized */}
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 10mm 14mm 10mm 14mm;
                    }
                    html, body {
                        width: 210mm !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #ffffff !important;
                    }
                    body * {
                        visibility: hidden;
                    }
                    #procurement-order-sheet, #procurement-order-sheet * {
                        visibility: visible;
                    }
                    #procurement-order-sheet {
                        position: absolute;
                        left: 0;
                        top: 0;
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
                <div className="no-print flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl">
                            <FileText size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-base text-white">Surat Perintah Pengadaan</h3>
                                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold rounded-full">
                                    E-Office Terdaftar
                                </span>
                            </div>
                            <p className="text-xs text-slate-400">
                                No. Surat: <span className="font-mono text-amber-300 font-semibold">{orderNumber}</span>
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {!assigneeSignature ? (
                            <button
                                onClick={() => setShowSignPad(true)}
                                className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
                            >
                                <PenTool size={15} /> Tandatangani Langsung
                            </button>
                        ) : (
                            <button
                                onClick={() => setShowSignPad(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-medium rounded-xl transition-all cursor-pointer"
                                title="Perbarui tanda tangan penerima perintah"
                            >
                                <PenTool size={13} /> Ubah TTD Petugas
                            </button>
                        )}
                        {!assigneeSignature && (
                            <button
                                onClick={handleManualNotify}
                                disabled={notifying}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
                                title="Kirim pengingat tanda tangan via WhatsApp ke petugas"
                            >
                                <Send size={13} /> {notifying ? 'Mengirim...' : 'Kirim WA Petugas'}
                            </button>
                        )}
                        <button
                            onClick={handlePrint}
                            disabled={notifying}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-50"
                            title="Cetak A4 / PDF sekaligus mengirimkan pemberitahuan WhatsApp ke petugas"
                        >
                            <Printer size={15} /> Cetak / PDF (A4)
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100/70 print:p-0 print:bg-white">
                    <div
                        id="procurement-order-sheet"
                        ref={printAreaRef}
                        className="bg-white mx-auto max-w-[800px] p-6 sm:p-10 rounded-lg shadow-sm print:shadow-none border border-slate-200 print:border-none text-slate-900"
                        style={{ fontFamily: "'Times New Roman', Times, serif", lineHeight: 1.4, fontSize: '11pt' }}
                    >
                        {/* KOP SURAT BIDANG SARANA */}
                        <div className="pb-2 mb-4 border-b-[3px] border-double border-slate-900">
                            <div className="flex items-center justify-between gap-4">
                                <div className="w-18 sm:w-22 flex-shrink-0 text-left">
                                    <img
                                        src="/logo_yayasan.jpg"
                                        alt="Logo Yayasan"
                                        className="h-14 sm:h-18 w-auto object-contain mx-auto"
                                        onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                </div>
                                <div className="flex-1 text-center px-2">
                                    <h4 className="text-xs sm:text-sm font-bold tracking-wider text-emerald-800 uppercase font-sans">
                                        YAYASAN DAR EL-IMAN PADANG
                                    </h4>
                                    <h2 className="text-base sm:text-xl font-black tracking-wide text-amber-700 uppercase font-sans mt-0.5">
                                        BIDANG SARANA
                                    </h2>
                                    <p className="text-[9.5pt] text-slate-600 italic font-serif mt-0.5">
                                        &ldquo;Merawat dengan Ikhlas, Melayani dengan Sunnah&rdquo;
                                    </p>
                                    <p className="text-[8.5pt] text-slate-600 font-sans mt-0.5 leading-tight">
                                        Komplek Islamic Center, Surau Gadang, Kec. Nanggalo, Kota Padang, Sumatera Barat 25173
                                    </p>
                                    <p className="text-[8pt] text-slate-600 font-sans">
                                        WA: 0895-3202-42508 • Email: dar.el.imansarpras@gmail.com
                                    </p>
                                </div>
                                <div className="w-18 sm:w-22 flex-shrink-0 text-right">
                                    <img
                                        src="/Sarpras.jpeg"
                                        alt="Logo Sarpras"
                                        className="h-14 sm:h-18 w-auto object-contain mx-auto"
                                        onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* JUDUL SURAT & NOMOR */}
                        <div className="text-center mb-4">
                            <h3 className="text-[13pt] font-black tracking-wide uppercase underline text-slate-950">
                                SURAT PERINTAH TUGAS PENGADAAN
                            </h3>
                            <p className="text-[10.5pt] font-mono mt-0.5 font-bold text-slate-800">
                                Nomor: {orderNumber}
                            </p>
                        </div>

                        {/* DASAR PERINTAH / KONSIDERAN (SIMAS dihilangkan) */}
                        <div className="mb-3 text-justify">
                            <p className="indent-8 leading-relaxed">
                                Menindaklanjuti permohonan pengadaan barang/jasa yang diajukan oleh <strong>{unitName}</strong> dengan nomor registrasi <strong>{procurementCode}</strong> perihal <em>&ldquo;{procurementTitle}&rdquo;</em>, maka bersama ini:
                            </p>
                        </div>

                        {/* PIHAK PEMBERI PERINTAH */}
                        <div className="mb-3 text-[11pt]">
                            <table className="w-full">
                                <tbody>
                                    <tr>
                                        <td className="w-44 align-top font-semibold">Nama Pemberi Tugas</td>
                                        <td className="w-4 align-top">:</td>
                                        <td className="font-bold">{assignerName}</td>
                                    </tr>
                                    <tr>
                                        <td className="align-top font-semibold">Jabatan</td>
                                        <td className="align-top">:</td>
                                        <td>{assignerPosition}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* PIHAK PENERIMA PERINTAH */}
                        <div className="mb-3 text-[11pt]">
                            <p className="font-semibold mb-1">MEMBERIKAN PERINTAH KEPADA:</p>
                            <table className="w-full">
                                <tbody>
                                    <tr>
                                        <td className="w-44 align-top font-semibold">Nama Petugas</td>
                                        <td className="w-4 align-top">:</td>
                                        <td className="font-bold underline">{assignee.name || 'Petugas Pengadaan'}</td>
                                    </tr>
                                    <tr>
                                        <td className="align-top font-semibold">Jabatan</td>
                                        <td className="align-top">:</td>
                                        <td>{assignee.position || 'Staf Pelaksana Pengadaan'}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* TUGAS & RINCIAN BARANG */}
                        <div className="mb-2 text-justify">
                            <p className="font-semibold mb-1">UNTUK:</p>
                            <ol className="list-decimal pl-6 space-y-1 text-[10.5pt]">
                                <li>
                                    Melaksanakan survei perbandingan harga pasar, evaluasi vendor/penyedia terpercaya, dan proses pengadaan barang/jasa sesuai dengan rincian kebutuhan berikut:
                                </li>
                            </ol>
                        </div>

                        {/* TABEL RINCIAN BARANG */}
                        <div className="mb-3 overflow-x-auto">
                            <table className="w-full border-collapse border border-slate-900 text-[10pt]">
                                <thead>
                                    <tr className="bg-slate-100 text-slate-950 font-bold text-center">
                                        <th className="border border-slate-900 px-2 py-1 w-10">No</th>
                                        <th className="border border-slate-900 px-2.5 py-1 text-left">Nama Barang / Uraian</th>
                                        <th className="border border-slate-900 px-2.5 py-1 text-left">Spesifikasi</th>
                                        <th className="border border-slate-900 px-2 py-1 w-18 text-center">Volume</th>
                                        <th className="border border-slate-900 px-2.5 py-1 text-right w-24">Est. Harga</th>
                                        <th className="border border-slate-900 px-2.5 py-1 text-right w-28">Total Est.</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {assignedItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="border border-slate-900 px-3 py-2 text-center italic text-slate-500">
                                                Tidak ada rincian item.
                                            </td>
                                        </tr>
                                    ) : (
                                        assignedItems.map((item, idx) => {
                                            const qty = parseFloat(item.qty || item.quantity || 1) || 1;
                                            const price = parseFloat(item.estPrice || item.estimatedPrice || item.price || 0) || 0;
                                            const subtotal = qty * price;
                                            return (
                                                <tr key={idx}>
                                                    <td className="border border-slate-900 px-2 py-1 text-center">{idx + 1}</td>
                                                    <td className="border border-slate-900 px-2.5 py-1 font-medium">{item.name}</td>
                                                    <td className="border border-slate-900 px-2.5 py-1 text-slate-700">{item.spec || '-'}</td>
                                                    <td className="border border-slate-900 px-2 py-1 text-center">{qty} {item.unit || 'Unit'}</td>
                                                    <td className="border border-slate-900 px-2.5 py-1 text-right">{price > 0 ? formatCurrency(price) : '-'}</td>
                                                    <td className="border border-slate-900 px-2.5 py-1 text-right font-medium">{subtotal > 0 ? formatCurrency(subtotal) : '-'}</td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                                {totalEstimate > 0 && (
                                    <tfoot>
                                        <tr className="bg-slate-50 font-bold">
                                            <td colSpan={5} className="border border-slate-900 px-2.5 py-1 text-right">
                                                Total Perkiraan Biaya Pengadaan:
                                            </td>
                                            <td className="border border-slate-900 px-2.5 py-1 text-right font-bold text-slate-950">
                                                {formatCurrency(totalEstimate)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>

                        {/* INSTRUKSI TAMBAHAN */}
                        <div className="mb-3 text-justify text-[10.5pt]">
                            <ol start={2} className="list-decimal pl-6 space-y-1">
                                <li>
                                    Menginput sekurang-kurangnya vendor pembanding (jika dibutuhkan) serta harga penawaran resmi sesuai ketentuan SOP Pengadaan.
                                </li>
                                <li>
                                    Menjaga kesesuaian mutu, spesifikasi, kuantitas barang, dan mengkoordinasikan proses serah terima barang (BAST) bersama unit pemohon.
                                </li>
                                <li>
                                    Melaporkan seluruh tahapan pelaksanaan tugas kepada Kepala Bidang Sarana.
                                </li>
                            </ol>
                        </div>

                        {/* CATATAN KHUSUS */}
                        {notes && (
                            <div className="mb-3 text-[10.5pt] p-2 border border-slate-300 rounded bg-slate-50/50">
                                <span className="font-bold block text-slate-800 mb-0.5">Instruksi Khusus / Catatan:</span>
                                <p className="text-slate-700 whitespace-pre-line">{notes}</p>
                            </div>
                        )}

                        {/* CLOSING */}
                        <div className="mb-4 text-justify text-[10.5pt]">
                            <p className="indent-8 leading-relaxed">
                                Surat perintah ini berlaku sejak tanggal diterbitkan hingga proses serah terima pengadaan barang/jasa selesai dilaksanakan dengan penuh rasa tanggung jawab dan amanah.
                            </p>
                        </div>

                        {/* TANDA TANGAN 2 PIHAK */}
                        <div className="pt-1">
                            <div className="text-right text-[11pt] mb-2">
                                Padang, {formattedDate}
                            </div>
                            <div className="grid grid-cols-2 gap-6 text-center text-[10.5pt]">
                                {/* KOLOM KIRI: PENERIMA PERINTAH (TTD PAD PETUGAS) */}
                                <div className="flex flex-col items-center justify-between min-h-[145px] p-2 border border-dashed border-slate-300 rounded-lg">
                                    <div>
                                        <p className="font-semibold text-slate-900">Penerima Perintah,</p>
                                        <p className="text-slate-600 text-[9.5pt]">Petugas Pengadaan</p>
                                    </div>

                                    <div className="my-1.5 flex items-center justify-center min-h-[65px] w-full">
                                        {assigneeSignature ? (
                                            <div className="flex flex-col items-center group">
                                                <img
                                                    src={assigneeSignature}
                                                    alt="TTD Penerima Tugas"
                                                    className="max-h-16 max-w-[160px] object-contain"
                                                />
                                                {assigneeSignedAt && (
                                                    <span className="text-[7.5pt] text-slate-500 italic mt-0.5">
                                                        Ditandatangani: {new Date(assigneeSignedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </span>
                                                )}
                                                <button
                                                    onClick={() => setShowSignPad(true)}
                                                    className="no-print mt-1 text-[7.5pt] text-blue-600 hover:text-blue-800 underline flex items-center gap-1 font-sans cursor-pointer"
                                                    title="Ubah tanda tangan penerima tugas"
                                                >
                                                    <PenTool size={10} /> Ubah TTD
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setShowSignPad(true)}
                                                className="no-print px-3 py-2 bg-blue-50 hover:bg-blue-100 border-2 border-dashed border-blue-400 text-blue-700 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                                                title="Klik untuk langsung menggambar tanda tangan di sini"
                                            >
                                                <PenTool size={15} className="text-blue-600 animate-pulse" />
                                                <span>Klik untuk Tanda Tangan</span>
                                            </button>
                                        )}
                                    </div>

                                    <div>
                                        <p className="font-bold underline text-slate-950">{assignee.name || '(.......................................)'}</p>
                                        <p className="text-slate-600 text-[9pt]">NIY. {assigneeNiy}</p>
                                    </div>
                                </div>

                                {/* KOLOM KANAN: PEMBERI PERINTAH (TTE KABID SARANA + QR CODE E-OFFICE) */}
                                <div className="flex flex-col items-center justify-between min-h-[145px] p-2 border border-emerald-300 bg-emerald-50/30 rounded-lg">
                                    <div>
                                        <p className="font-semibold text-slate-900">Pemberi Perintah,</p>
                                        <p className="text-slate-600 text-[9.5pt]">{assignerPosition}</p>
                                    </div>

                                    <div className="my-1.5 flex flex-col items-center justify-center min-h-[65px] w-full">
                                        {qrCodeData ? (
                                            <div className="flex items-center gap-2">
                                                <img
                                                    src={qrCodeData}
                                                    alt="QR Code Verifikasi E-Office"
                                                    className="w-15 h-15 sm:w-16 sm:h-16 object-contain border border-slate-200 bg-white p-0.5 rounded shadow-xs"
                                                />
                                                <div className="text-left font-sans">
                                                    <div className="flex items-center gap-1 text-emerald-700 font-bold text-[8pt]">
                                                        <ShieldCheck size={12} className="text-emerald-600 flex-shrink-0" />
                                                        <span>TTE SAH ELEKTRONIK</span>
                                                    </div>
                                                    <p className="text-[6.5pt] text-slate-600 leading-tight mt-0.5">
                                                        Tercatat pada E-Office Surat Keluar
                                                    </p>
                                                    <p className="text-[6pt] font-mono text-slate-500 mt-0.5">
                                                        UUID: {docUuid?.substring(0, 13)}...
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="border border-dashed border-emerald-300 bg-emerald-50 rounded-lg p-2 text-center">
                                                <ShieldCheck size={16} className="mx-auto text-emerald-600 mb-0.5" />
                                                <span className="text-emerald-700 text-[8.5pt] font-bold block leading-tight font-sans">
                                                    TERVERIFIKASI TTE
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <p className="font-bold underline text-slate-950">{assignerName}</p>
                                        <p className="text-slate-600 text-[9pt]">NIY. {assignerNiy}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Signature Modal for Assignee */}
            {showSignPad && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-4 shadow-2xl">
                        <SignaturePad
                            storageKey="saved_assignee_signature"
                            title="Tanda Tangan Penerima Perintah Pengadaan"
                            onSave={handleSaveSignature}
                            onCancel={() => setShowSignPad(false)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProcurementAssignmentOrderModal;
