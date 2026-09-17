import React, { useRef, useState, useEffect } from 'react';
import { X, Printer, CheckCircle2, ShieldCheck, Clock, FileText, AlertCircle } from 'lucide-react';
import api from '../lib/axios';

const ProcurementLetterModal = ({
    isOpen,
    onClose,
    letterData,
    onKabidTte = null,
    isKabidUser = false,
    canSignHeadUnit = false,
    onOpenHeadUnitSign = null
}) => {
    const printAreaRef = useRef(null);
    const [fetchedKabidName, setFetchedKabidName] = useState('');

    useEffect(() => {
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
            .catch(err => {
                // If unauthenticated or request error, gracefully fallback
            });
    }, []);

    if (!isOpen || !letterData) return null;

    const {
        letterNumber = '-',
        createdAt = new Date(),
        title = 'Permohonan Pengadaan Barang / Jasa',
        unitName = 'Unit Pemohon',
        unitAddress = 'Kota Padang, Sumatera Barat',
        unitPhone = '',
        requesterName = '-',
        requesterPosition = 'Pemohon',
        requesterSignature = null,
        headUnitName = '-',
        headUnitSignature = null,
        headUnitApprovedAt = null,
        kabidName = '',
        kabidTte = false,
        kabidTteAt = null,
        items = [],
        notes = ''
    } = letterData;

    const displayKabidName = fetchedKabidName || kabidName || 'Kepala Bidang Sarana';

    const formattedDate = new Date(createdAt).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    const formatCurrency = (val) => {
        if (!val || isNaN(val)) return 'Rp 0';
        return `Rp ${Number(val).toLocaleString('id-ID')}`;
    };

    const totalEstimate = items.reduce((acc, it) => {
        const p = parseFloat(it.estimatedPrice || it.price || 0) || 0;
        const q = parseFloat(it.qty || it.quantity || 1) || 1;
        return acc + (p * q);
    }, 0);

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:fixed print:inset-0">
            {/* Embedded Print Styling */}
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    #procurement-letter-sheet, #procurement-letter-sheet * {
                        visibility: visible;
                    }
                    #procurement-letter-sheet {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100% !important;
                        max-width: 100% !important;
                        padding: 20mm 15mm !important;
                        margin: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `}} />

            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 print:border-none print:shadow-none print:max-h-none print:w-full">
                {/* Modal Action Header (Hidden in Print) */}
                <div className="no-print flex items-center justify-between px-6 py-4 bg-slate-800 text-white border-b border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
                            <FileText size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-base text-white">Surat Permohonan Pengadaan Unit</h3>
                            <p className="text-xs text-slate-400">No. Surat: <span className="font-mono text-blue-300 font-semibold">{letterNumber}</span></p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {isKabidUser && !kabidTte && onKabidTte && (
                            <button
                                onClick={onKabidTte}
                                className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-md"
                            >
                                <ShieldCheck size={16} /> Beri TTE Kabid Sarana
                            </button>
                        )}
                        {canSignHeadUnit && !headUnitSignature && onOpenHeadUnitSign && (
                            <button
                                onClick={onOpenHeadUnitSign}
                                className="flex items-center gap-2 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md"
                            >
                                <CheckCircle2 size={16} /> TTD Kepala Unit
                            </button>
                        )}
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-xl transition-all"
                        >
                            <Printer size={15} /> Cetak / PDF
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Printable Sheet Viewport */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100/70 print:p-0 print:bg-white">
                    <div
                        id="procurement-letter-sheet"
                        ref={printAreaRef}
                        className="bg-white mx-auto max-w-[800px] p-8 sm:p-12 rounded-lg shadow-sm print:shadow-none border border-slate-200 print:border-none text-slate-900"
                        style={{ fontFamily: "'Times New Roman', Times, serif", lineHeight: 1.5, fontSize: '13pt' }}
                    >
                        {/* KOP SURAT UNIT PEMOHON (NO KOP BIDANG SARANA) */}
                        <div className="text-center pb-3 mb-5 border-b-[3px] border-double border-slate-900">
                            <div className="text-base sm:text-lg font-bold tracking-wider uppercase text-slate-800">
                                YAYASAN DAR EL-IMAN
                            </div>
                            <div className="text-lg sm:text-xl font-black tracking-wide uppercase text-slate-950 mt-0.5">
                                {unitName}
                            </div>
                            <div className="text-[10.5pt] text-slate-600 italic mt-0.5">
                                {unitAddress || 'Kota Padang, Sumatera Barat'} {unitPhone ? `• Telp/WA: ${unitPhone}` : ''}
                            </div>
                        </div>

                        {/* NOMOR & TANGGAL SURAT */}
                        <div className="flex justify-between items-start mb-6 text-[12pt]">
                            <div>
                                <table className="text-[12pt]">
                                    <tbody>
                                        <tr>
                                            <td className="pr-2 font-semibold">Nomor</td>
                                            <td className="pr-2">:</td>
                                            <td className="font-bold">{letterNumber}</td>
                                        </tr>
                                        <tr>
                                            <td className="pr-2 font-semibold">Lampiran</td>
                                            <td className="pr-2">:</td>
                                            <td>-</td>
                                        </tr>
                                        <tr>
                                            <td className="pr-2 font-semibold">Perihal</td>
                                            <td className="pr-2">:</td>
                                            <td className="font-bold underline">{title}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <div className="text-right">
                                <p>Padang, {formattedDate}</p>
                            </div>
                        </div>

                        {/* OPENING STATEMENT (No "Kepada Yth" section) */}
                        <div className="mb-4 text-justify">
                            <p>
                                <em>Assalamu’alaikum Warahmatullahi Wabarakatuh</em>,
                            </p>
                            <p className="mt-2 indent-8">
                                Bersama surat ini, kami dari <strong>{unitName}</strong> mengajukan permohonan pengadaan barang/jasa untuk kebutuhan operasional dengan rincian kebutuhan sebagai berikut:
                            </p>
                        </div>

                        {/* ITEMS TABLE */}
                        <div className="mb-5 overflow-x-auto">
                            <table className="w-full border-collapse border border-slate-900 text-[11pt]">
                                <thead>
                                    <tr className="bg-slate-100 text-slate-950">
                                        <th className="border border-slate-900 px-2 py-1.5 text-center w-10">No</th>
                                        <th className="border border-slate-900 px-3 py-1.5 text-left">Nama Barang / Deskripsi</th>
                                        <th className="border border-slate-900 px-2 py-1.5 text-center w-24">Jumlah</th>
                                        <th className="border border-slate-900 px-3 py-1.5 text-right w-32">Estimasi Harga</th>
                                        <th className="border border-slate-900 px-3 py-1.5 text-right w-36">Total Estimasi</th>
                                        <th className="border border-slate-900 px-3 py-1.5 text-left">Keperluan / Ket.</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="border border-slate-900 px-3 py-4 text-center italic text-slate-500">
                                                Tidak ada rincian item.
                                            </td>
                                        </tr>
                                    ) : (
                                        items.map((item, idx) => {
                                            const qty = parseFloat(item.qty || item.quantity || 1) || 1;
                                            const price = parseFloat(item.estimatedPrice || item.price || 0) || 0;
                                            const subtotal = qty * price;
                                            return (
                                                <tr key={idx}>
                                                    <td className="border border-slate-900 px-2 py-1.5 text-center">{idx + 1}</td>
                                                    <td className="border border-slate-900 px-3 py-1.5 font-medium">{item.name || item.itemName}</td>
                                                    <td className="border border-slate-900 px-2 py-1.5 text-center">{qty} {item.unit || 'Unit'}</td>
                                                    <td className="border border-slate-900 px-3 py-1.5 text-right">{price > 0 ? formatCurrency(price) : '-'}</td>
                                                    <td className="border border-slate-900 px-3 py-1.5 text-right font-medium">{subtotal > 0 ? formatCurrency(subtotal) : '-'}</td>
                                                    <td className="border border-slate-900 px-3 py-1.5 text-slate-700">{item.spec || item.description || '-'}</td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                                {totalEstimate > 0 && (
                                    <tfoot>
                                        <tr className="bg-slate-50 font-bold">
                                            <td colSpan={4} className="border border-slate-900 px-3 py-1.5 text-right">
                                                Total Perkiraan Biaya:
                                            </td>
                                            <td className="border border-slate-900 px-3 py-1.5 text-right">
                                                {formatCurrency(totalEstimate)}
                                            </td>
                                            <td className="border border-slate-900 px-3 py-1.5"></td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>

                        {/* CATATAN / ALASAN KEBUTUHAN */}
                        {notes && (
                            <div className="mb-5 text-[11.5pt] p-2.5 border border-slate-300 rounded bg-slate-50/50">
                                <span className="font-bold block text-slate-800 mb-0.5">Catatan Tambahan:</span>
                                <p className="text-slate-700 whitespace-pre-line">{notes}</p>
                            </div>
                        )}

                        {/* CLOSING STATEMENT */}
                        <div className="mb-8 text-justify">
                            <p className="indent-8">
                                Demikian surat permohonan ini kami sampaikan, atas perhatian dan persetujuannya kami ucapkan <em>jazakumullahu khairan</em>.
                            </p>
                            <p className="mt-2">
                                <em>Wassalamu’alaikum Warahmatullahi Wabarakatuh</em>.
                            </p>
                        </div>

                        {/* 3 SIGNATURE COLUMNS: Pemohon | Menyetujui: Kepala Unit | Mengetahui: Kabid Sarana */}
                        <div className="pt-2">
                            <div className="grid grid-cols-3 gap-3 text-center text-[11pt]">
                                {/* Kolom 1: Yang Memohon */}
                                <div className="flex flex-col items-center justify-between min-h-[145px]">
                                    <div>
                                        <p className="font-medium">Yang Memohon,</p>
                                        <p className="text-slate-600 text-[10pt]">{unitName}</p>
                                    </div>
                                    <div className="my-1 flex items-center justify-center h-20 w-full">
                                        {requesterSignature ? (
                                            <img
                                                src={requesterSignature}
                                                alt="TTD Pemohon"
                                                className="max-h-20 max-w-[140px] object-contain"
                                            />
                                        ) : (
                                            <span className="text-slate-400 text-[10pt] italic">(Tanda Tangan)</span>
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-bold underline text-slate-900">{requesterName}</p>
                                        <p className="text-slate-600 text-[9.5pt]">{requesterPosition || 'Pemohon'}</p>
                                    </div>
                                </div>

                                {/* Kolom 2: Menyetujui: Kepala Unit */}
                                <div className="flex flex-col items-center justify-between min-h-[145px]">
                                    <div>
                                        <p className="font-medium">Menyetujui,</p>
                                        <p className="font-bold text-slate-900 text-[10pt]">Kepala Unit</p>
                                    </div>
                                    <div className="my-1 flex items-center justify-center h-20 w-full">
                                        {headUnitSignature ? (
                                            <div className="flex flex-col items-center">
                                                <img
                                                    src={headUnitSignature}
                                                    alt="TTD Kepala Unit"
                                                    className="max-h-20 max-w-[140px] object-contain"
                                                />
                                                {headUnitApprovedAt && (
                                                    <span className="text-[7.5pt] text-slate-400 italic">
                                                        {new Date(headUnitApprovedAt).toLocaleDateString('id-ID')}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="border border-dashed border-amber-300 bg-amber-50/50 rounded-lg p-2 text-center">
                                                <Clock size={16} className="mx-auto text-amber-500 mb-0.5" />
                                                <span className="text-amber-700 text-[8.5pt] italic block leading-tight font-sans">
                                                    Menunggu Persetujuan Kepala Unit
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-bold underline text-slate-900">{headUnitName || '(..........................)'}</p>
                                        <p className="text-slate-600 text-[9.5pt]">Kepala {unitName}</p>
                                    </div>
                                </div>

                                {/* Kolom 3: Diterima / Mengetahui: Kepala Bidang Sarana (TTE) */}
                                <div className="flex flex-col items-center justify-between min-h-[145px]">
                                    <div>
                                        <p className="font-medium">Diterima / Mengetahui,</p>
                                        <p className="font-bold text-slate-900 text-[10pt]">Bidang Sarana &amp; Prasarana</p>
                                    </div>
                                    <div className="my-1 flex items-center justify-center h-20 w-full">
                                        {kabidTte ? (
                                            <div className="border-2 border-emerald-600 bg-emerald-50 rounded-lg p-2 text-center shadow-xs">
                                                <div className="flex items-center justify-center gap-1 text-emerald-700 font-bold text-[9pt] font-sans">
                                                    <ShieldCheck size={14} className="text-emerald-600" />
                                                    <span>TERVERIFIKASI TTE</span>
                                                </div>
                                                <div className="text-[7.5pt] text-emerald-800 mt-0.5 font-sans leading-tight">
                                                    Dokumen Sah Elektronik
                                                    {kabidTteAt && (
                                                        <span className="block text-slate-500">
                                                            {new Date(kabidTteAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="border border-dashed border-slate-300 bg-slate-50 rounded-lg p-2 text-center">
                                                <ShieldCheck size={16} className="mx-auto text-slate-400 mb-0.5" />
                                                <span className="text-slate-500 text-[8.5pt] italic block leading-tight font-sans">
                                                    Menunggu Verifikasi TTE Kabid Sarana
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-bold underline text-slate-900">{displayKabidName}</p>
                                        <p className="text-slate-600 text-[9.5pt]">Kepala Bidang Sarana</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProcurementLetterModal;
