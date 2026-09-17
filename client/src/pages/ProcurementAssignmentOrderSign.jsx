import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { 
    CheckCircle2, AlertCircle, FileText, Printer, Clock, 
    ShieldCheck, ArrowRight, Sparkles, PenTool, ExternalLink 
} from 'lucide-react';
import SignaturePad from '../components/SignaturePad';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const ProcurementAssignmentOrderSign = () => {
    const { orderId } = useParams();
    const printAreaRef = useRef(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [orderData, setOrderData] = useState(null);
    const [procurement, setProcurement] = useState(null);

    const [showSignPad, setShowSignPad] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    useEffect(() => {
        fetchOrder();
    }, [orderId]);

    const fetchOrder = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await axios.get(`${API_URL}/procurements/public/assignment-orders/${orderId}`);
            setOrderData(res.data.order);
            setProcurement(res.data.procurement);
            if (res.data.order?.assigneeSignature) {
                setIsSuccess(true);
            }
        } catch (err) {
            console.error('Fetch assignment order error:', err);
            setError(err.response?.data?.error || 'Gagal memuat Surat Perintah Pengadaan.');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSignature = async (sigDataUrl) => {
        if (!sigDataUrl) return;
        setSubmitting(true);
        try {
            const res = await axios.post(`${API_URL}/procurements/public/assignment-orders/${orderId}/sign`, {
                signature: sigDataUrl
            });
            setOrderData(res.data.order);
            setIsSuccess(true);
            setShowSignPad(false);
            alert('Surat Perintah Pengadaan berhasil ditandatangani.');
        } catch (err) {
            console.error('Sign order error:', err);
            alert(err.response?.data?.error || 'Gagal menandatangani Surat Perintah.');
        } finally {
            setSubmitting(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const formatCurrency = (val) => {
        if (!val || isNaN(val)) return 'Rp 0';
        return `Rp ${Number(val).toLocaleString('id-ID')}`;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-600 font-medium">Memuat Surat Perintah Pengadaan…</p>
                </div>
            </div>
        );
    }

    if (error || !orderData) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white rounded-2xl p-6 shadow-xl border border-slate-200 text-center">
                    <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle size={28} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">Dokumen Tidak Ditemukan</h3>
                    <p className="text-sm text-slate-600 mb-6">{error || 'Surat Perintah Pengadaan tidak ditemukan atau tautan sudah tidak valid.'}</p>
                    <Link
                        to="/procurements"
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-all"
                    >
                        Ke Halaman Pengadaan
                    </Link>
                </div>
            </div>
        );
    }

    const {
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
        qrCodeData = null,
        assigneeSignature = null,
        assigneeSignedAt = null
    } = orderData;

    const formattedDate = new Date(createdAt).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    const totalEstimate = (assignedItems || []).reduce((acc, it) => {
        const p = parseFloat(it.estPrice || it.estimatedPrice || it.price || 0) || 0;
        const q = parseFloat(it.qty || it.quantity || 1) || 1;
        return acc + (p * q);
    }, 0);

    return (
        <div className="min-h-screen bg-slate-100 text-slate-900 print:bg-white print:p-0">
            {/* Embedded Print Styling */}
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    #public-order-sheet, #public-order-sheet * {
                        visibility: visible;
                    }
                    #public-order-sheet {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100% !important;
                        max-width: 100% !important;
                        padding: 15mm 15mm !important;
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

            {/* Top Navigation Bar */}
            <header className="no-print bg-slate-900 text-white sticky top-0 z-30 shadow-md border-b border-slate-800">
                <div className="max-w-4xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
                            <FileText size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-sm sm:text-base font-bold text-white">Surat Perintah Pengadaan</h1>
                                <span className="hidden sm:inline-block px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold rounded-full">
                                    E-Office Terdaftar
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 font-mono">
                                No: <span className="text-amber-300 font-semibold">{orderNumber}</span>
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {!assigneeSignature && (
                            <button
                                onClick={() => setShowSignPad(true)}
                                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95"
                            >
                                <PenTool size={14} /> Tandatangani
                            </button>
                        )}
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-slate-700 transition-all"
                        >
                            <Printer size={14} /> Cetak
                        </button>
                        {procurement?.id && (
                            <Link
                                to={`/procurements/${procurement.id}`}
                                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-slate-700 transition-all"
                            >
                                Detail Pengadaan <ExternalLink size={13} />
                            </Link>
                        )}
                    </div>
                </div>
            </header>

            {/* Status Banner */}
            <div className="no-print max-w-4xl mx-auto px-4 pt-4">
                {assigneeSignature ? (
                    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <CheckCircle2 size={22} className="text-emerald-600 flex-shrink-0" />
                            <div>
                                <h4 className="text-sm font-bold">Surat Perintah Telah Ditandatangani</h4>
                                <p className="text-xs text-emerald-700">
                                    Ditandatangani oleh <strong>{assignee.name}</strong> pada {new Date(assigneeSignedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}.
                                </p>
                            </div>
                        </div>
                        {procurement?.id && (
                            <Link
                                to={`/procurements/${procurement.id}`}
                                className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 flex-shrink-0"
                            >
                                Lanjut Pemilihan Vendor <ArrowRight size={14} />
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Clock size={22} className="text-blue-600 flex-shrink-0" />
                            <div>
                                <h4 className="text-sm font-bold">Menunggu Tanda Tangan Petugas</h4>
                                <p className="text-xs text-blue-700">
                                    Silakan periksa rincian tugas pengadaan di bawah ini, lalu klik tombol <strong>Tandatangani</strong> untuk membubuhkan tanda tangan Anda.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowSignPad(true)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 flex-shrink-0 active:scale-95"
                        >
                            <PenTool size={15} /> Tandatangani Sekarang
                        </button>
                    </div>
                )}
            </div>

            {/* Document Body Viewport */}
            <main className="max-w-4xl mx-auto p-4 sm:p-6 print:p-0">
                <div
                    id="public-order-sheet"
                    ref={printAreaRef}
                    className="bg-white mx-auto max-w-[800px] p-8 sm:p-12 rounded-xl shadow-sm print:shadow-none border border-slate-200 print:border-none text-slate-900"
                    style={{ fontFamily: "'Times New Roman', Times, serif", lineHeight: 1.45, fontSize: '12pt' }}
                >
                    {/* KOP SURAT BIDANG SARANA & PRASARANA */}
                    <div className="pb-3 mb-5 border-b-[3px] border-double border-slate-900">
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
                                    BIDANG SARANA &amp; PRASARANA
                                </h2>
                                <p className="text-[10pt] text-slate-600 italic font-serif mt-0.5">
                                    &ldquo;Merawat dengan Ikhlas, Melayani dengan Sunnah&rdquo;
                                </p>
                                <p className="text-[9pt] text-slate-600 font-sans mt-1 leading-tight">
                                    Komplek Islamic Center, Surau Gadang, Kec. Nanggalo, Kota Padang, Sumatera Barat 25173
                                </p>
                                <p className="text-[8.5pt] text-slate-600 font-sans">
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

                    {/* JUDUL SURAT & NOMOR */}
                    <div className="text-center mb-6">
                        <h3 className="text-[14pt] font-black tracking-wide uppercase underline text-slate-950">
                            SURAT PERINTAH TUGAS PENGADAAN
                        </h3>
                        <p className="text-[11pt] font-mono mt-0.5 font-bold text-slate-800">
                            Nomor: {orderNumber}
                        </p>
                    </div>

                    {/* DASAR PERINTAH / KONSIDERAN */}
                    <div className="mb-4 text-justify">
                        <p className="indent-8">
                            Menindaklanjuti permohonan pengadaan barang/jasa yang diajukan oleh <strong>{unitName}</strong> melalui Sistem Informasi Manajemen Aset (SIMAS) dengan nomor registrasi <strong>{procurementCode}</strong> perihal <em>&ldquo;{procurementTitle}&rdquo;</em>, maka bersama ini:
                        </p>
                    </div>

                    {/* PIHAK PEMBERI PERINTAH */}
                    <div className="mb-4 text-[11.5pt]">
                        <table className="w-full">
                            <tbody>
                                <tr>
                                    <td className="w-48 align-top font-semibold">Nama Pemberi Tugas</td>
                                    <td className="w-4 align-top">:</td>
                                    <td className="font-bold">{assigner.name || 'Pemberi Tugas'}</td>
                                </tr>
                                <tr>
                                    <td className="align-top font-semibold">Jabatan</td>
                                    <td className="align-top">:</td>
                                    <td>{assigner.position || 'Bidang Sarana & Prasarana'}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* PIHAK PENERIMA PERINTAH */}
                    <div className="mb-4 text-[11.5pt]">
                        <p className="font-semibold mb-1">MEMBERIKAN PERINTAH KEPADA:</p>
                        <table className="w-full">
                            <tbody>
                                <tr>
                                    <td className="w-48 align-top font-semibold">Nama Petugas</td>
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
                    <div className="mb-4 text-justify">
                        <p className="font-semibold mb-2">UNTUK:</p>
                        <ol className="list-decimal pl-6 space-y-1 text-[11pt]">
                            <li>
                                Melaksanakan survei perbandingan harga pasar, evaluasi vendor/penyedia terpercaya, dan proses pengadaan barang/jasa sesuai dengan rincian kebutuhan berikut:
                            </li>
                        </ol>
                    </div>

                    {/* TABEL RINCIAN BARANG */}
                    <div className="mb-4 overflow-x-auto">
                        <table className="w-full border-collapse border border-slate-900 text-[10.5pt]">
                            <thead>
                                <tr className="bg-slate-100 text-slate-950 font-bold text-center">
                                    <th className="border border-slate-900 px-2 py-1.5 w-10">No</th>
                                    <th className="border border-slate-900 px-3 py-1.5 text-left">Nama Barang / Uraian</th>
                                    <th className="border border-slate-900 px-3 py-1.5 text-left">Spesifikasi</th>
                                    <th className="border border-slate-900 px-2 py-1.5 w-20 text-center">Volume</th>
                                    <th className="border border-slate-900 px-3 py-1.5 text-right w-28">Est. Harga</th>
                                    <th className="border border-slate-900 px-3 py-1.5 text-right w-32">Total Est.</th>
                                </tr>
                            </thead>
                            <tbody>
                                {assignedItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="border border-slate-900 px-3 py-3 text-center italic text-slate-500">
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
                                                <td className="border border-slate-900 px-2 py-1.5 text-center">{idx + 1}</td>
                                                <td className="border border-slate-900 px-3 py-1.5 font-medium">{item.name}</td>
                                                <td className="border border-slate-900 px-3 py-1.5 text-slate-700">{item.spec || '-'}</td>
                                                <td className="border border-slate-900 px-2 py-1.5 text-center">{qty} {item.unit || 'Unit'}</td>
                                                <td className="border border-slate-900 px-3 py-1.5 text-right">{price > 0 ? formatCurrency(price) : '-'}</td>
                                                <td className="border border-slate-900 px-3 py-1.5 text-right font-medium">{subtotal > 0 ? formatCurrency(subtotal) : '-'}</td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                            {totalEstimate > 0 && (
                                <tfoot>
                                    <tr className="bg-slate-50 font-bold">
                                        <td colSpan={5} className="border border-slate-900 px-3 py-1.5 text-right">
                                            Total Perkiraan Biaya Pengadaan:
                                        </td>
                                        <td className="border border-slate-900 px-3 py-1.5 text-right font-bold text-slate-950">
                                            {formatCurrency(totalEstimate)}
                                        </td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>

                    {/* INSTRUKSI TAMBAHAN */}
                    <div className="mb-4 text-justify text-[11pt]">
                        <ol start={2} className="list-decimal pl-6 space-y-1">
                            <li>
                                Menginput sekurang-kurangnya vendor pembanding serta harga penawaran resmi ke dalam SIMAS sesuai ketentuan SOP Pengadaan.
                            </li>
                            <li>
                                Menjaga kesesuaian mutu, spesifikasi, kuantitas barang, dan mengkoordinasikan proses serah terima barang (BAST) bersama unit pemohon.
                            </li>
                            <li>
                                Melaporkan seluruh tahapan pelaksanaan tugas kepada Kepala Bidang Sarana &amp; Prasarana.
                            </li>
                        </ol>
                    </div>

                    {/* CATATAN KHUSUS */}
                    {notes && (
                        <div className="mb-5 text-[11pt] p-2.5 border border-slate-300 rounded bg-slate-50/50">
                            <span className="font-bold block text-slate-800 mb-0.5">Instruksi Khusus / Catatan:</span>
                            <p className="text-slate-700 whitespace-pre-line">{notes}</p>
                        </div>
                    )}

                    {/* CLOSING */}
                    <div className="mb-6 text-justify text-[11pt]">
                        <p className="indent-8">
                            Surat perintah ini berlaku sejak tanggal diterbitkan hingga proses serah terima pengadaan barang/jasa selesai dilaksanakan dengan penuh rasa tanggung jawab dan amanah.
                        </p>
                    </div>

                    {/* TANDA TANGAN 2 PIHAK */}
                    <div className="pt-2">
                        <div className="text-right text-[11.5pt] mb-3">
                            Padang, {formattedDate}
                        </div>
                        <div className="grid grid-cols-2 gap-6 text-center text-[11pt]">
                            {/* KOLOM KIRI: PENERIMA PERINTAH (TTD PETUGAS) */}
                            <div className="flex flex-col items-center justify-between min-h-[160px] p-2 border border-dashed border-slate-300 rounded-lg">
                                <div>
                                    <p className="font-semibold text-slate-900">Penerima Perintah,</p>
                                    <p className="text-slate-600 text-[10pt]">Petugas Pengadaan</p>
                                </div>

                                <div className="my-2 flex items-center justify-center min-h-[75px] w-full">
                                    {assigneeSignature ? (
                                        <div className="flex flex-col items-center">
                                            <img
                                                src={assigneeSignature}
                                                alt="TTD Penerima Tugas"
                                                className="max-h-20 max-w-[170px] object-contain"
                                            />
                                            {assigneeSignedAt && (
                                                <span className="text-[7.5pt] text-slate-500 italic mt-0.5">
                                                    Ditandatangani: {new Date(assigneeSignedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </span>
                                            )}
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setShowSignPad(true)}
                                            className="no-print px-3.5 py-1.5 bg-blue-50 border border-blue-300 text-blue-700 text-xs font-bold rounded-lg hover:bg-blue-100 transition-all flex items-center gap-1.5 shadow-xs"
                                        >
                                            <PenTool size={14} /> Klik untuk Tanda Tangan
                                        </button>
                                    )}
                                </div>

                                <div>
                                    <p className="font-bold underline text-slate-950">{assignee.name || '(.......................................)'}</p>
                                    <p className="text-slate-600 text-[9.5pt]">{assignee.position || 'Staf Pelaksana'}</p>
                                </div>
                            </div>

                            {/* KOLOM KANAN: PEMBERI PERINTAH (TTE KABID / STAFF ASET + QR CODE) */}
                            <div className="flex flex-col items-center justify-between min-h-[160px] p-2 border border-emerald-300 bg-emerald-50/30 rounded-lg">
                                <div>
                                    <p className="font-semibold text-slate-900">Pemberi Perintah,</p>
                                    <p className="text-slate-600 text-[10pt]">{assigner.position || 'Bidang Sarana & Prasarana'}</p>
                                </div>

                                <div className="my-2 flex flex-col items-center justify-center min-h-[75px] w-full">
                                    {qrCodeData ? (
                                        <div className="flex items-center gap-2">
                                            <img
                                                src={qrCodeData}
                                                alt="QR Code Verifikasi E-Office"
                                                className="w-18 h-18 sm:w-20 sm:h-20 object-contain border border-slate-200 bg-white p-1 rounded shadow-xs"
                                            />
                                            <div className="text-left font-sans">
                                                <div className="flex items-center gap-1 text-emerald-700 font-bold text-[8.5pt]">
                                                    <ShieldCheck size={13} className="text-emerald-600 flex-shrink-0" />
                                                    <span>TTE SAH ELEKTRONIK</span>
                                                </div>
                                                <p className="text-[7pt] text-slate-600 leading-tight mt-0.5">
                                                    Tercatat pada E-Office Surat Keluar
                                                </p>
                                                <p className="text-[6.5pt] font-mono text-slate-500 mt-0.5">
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
                                    <p className="font-bold underline text-slate-950">{assigner.name || 'Kepala Bidang Sarana'}</p>
                                    <p className="text-slate-600 text-[9.5pt]">{assigner.position || 'Kepala Bidang Sarana'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Signature Modal */}
            {showSignPad && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
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

export default ProcurementAssignmentOrderSign;
