import React, { useRef, useState, useEffect } from 'react';
import { X, Printer, CheckCircle2, ShieldCheck, Clock, FileText, AlertCircle, PenTool, Loader2 } from 'lucide-react';
import api from '../lib/axios';
import SignaturePad from './SignaturePad';
import QRCode from 'react-qr-code';

const formatKopAddress = (addr) => {
    if (!addr) return 'Sumatera Barat';
    let cleaned = addr
        .replace(/Kota\s+Padang,?\s*/gi, '')
        .replace(/Padang,?\s*/gi, '')
        .replace(/^[,\s-]+|[,\s-]+$/g, '')
        .trim();
    if (!cleaned) return 'Sumatera Barat';
    if (!cleaned.toLowerCase().includes('sumatera barat') && !cleaned.toLowerCase().includes('sumbar')) {
        cleaned = `${cleaned}, Sumatera Barat`;
    }
    return cleaned;
};

const ProcurementLetterModal = ({
    isOpen,
    onClose,
    letterData,
    onKabidTte = null,
    isKabidUser = false,
    canSignHeadUnit = false,
    onOpenHeadUnitSign = null,
    procurementId = null,
    onUpdated = null
}) => {
    const printAreaRef = useRef(null);
    const [fetchedKabidName, setFetchedKabidName] = useState('');
    const [currentHeadUnitSig, setCurrentHeadUnitSig] = useState(null);
    const [currentHeadUnitApprovedAt, setCurrentHeadUnitApprovedAt] = useState(null);
    const [currentHeadUnitName, setCurrentHeadUnitName] = useState('');
    const [showSignModal, setShowSignModal] = useState(false);
    const [editHeadUnitName, setEditHeadUnitName] = useState('');
    const [isSavingSign, setIsSavingSign] = useState(false);
    const [signError, setSignError] = useState('');

    useEffect(() => {
        if (letterData) {
            setCurrentHeadUnitSig(letterData.headUnitSignature || null);
            setCurrentHeadUnitApprovedAt(letterData.headUnitApprovedAt || null);
            setCurrentHeadUnitName(letterData.headUnitName || '');
            setEditHeadUnitName(letterData.headUnitName || '');
        }
    }, [letterData]);

    useEffect(() => {
        // Ambil nama user yang memiliki position "Kepala Bidang Sarana" (hanya jika terautentikasi)
        if (!localStorage.getItem('token')) return;
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
        unitAddress = 'Sumatera Barat',
        unitPhone = '',
        requesterName = '-',
        requesterPosition = 'Pemohon',
        requesterSignature = null,
        headUnitName = '-',
        kabidName = '',
        kabidTte = false,
        kabidTteAt = null,
        items: rawItems = [],
        notes = ''
    } = letterData;

    const items = Array.isArray(rawItems) ? rawItems : [];

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
        const p = parseFloat(it.estPrice ?? it.estimatedPrice ?? it.price ?? it.finalPrice ?? it.unitPrice ?? it.harga ?? 0) || 0;
        const q = parseFloat(it.qty || it.quantity || 1) || 1;
        return acc + (p * q);
    }, 0);

    const handlePrint = () => {
        window.print();
    };

    const handleSaveHeadUnitSignature = async (sigDataUrl) => {
        if (!sigDataUrl) {
            alert('Mohon goreskan tanda tangan terlebih dahulu.');
            return;
        }
        const effectiveName = editHeadUnitName?.trim() || currentHeadUnitName || headUnitName || '';
        if (!effectiveName) {
            alert('Nama Kepala Unit wajib diisi.');
            return;
        }

        try {
            setIsSavingSign(true);
            setSignError('');

            const batchKey = letterData?.batchId || letterData?.letterNumber || procurementId || 'approval';
            const payload = {
                signature: sigDataUrl,
                headUnitName: effectiveName,
                batchId: letterData?.batchId,
                letterNumber: letterData?.letterNumber,
                procurementId: procurementId || letterData?.procurementId || letterData?.id
            };

            const res = await api.post(`/procurements/public/head-unit-approval/${encodeURIComponent(batchKey)}`, payload);

            setCurrentHeadUnitSig(sigDataUrl);
            setCurrentHeadUnitApprovedAt(new Date().toISOString());
            setCurrentHeadUnitName(effectiveName);
            setShowSignModal(false);

            if (onUpdated) {
                onUpdated(res.data);
            }
            alert('Alhamdulillah, Surat Permohonan berhasil ditandatangani oleh Kepala Unit!');
        } catch (err) {
            console.error('Error saving head unit signature:', err);
            const msg = err.response?.data?.error || err.message || 'Gagal menyimpan tanda tangan Kepala Unit.';
            setSignError(msg);
            alert(`Gagal: ${msg}`);
        } finally {
            setIsSavingSign(false);
        }
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
                        {!currentHeadUnitSig && (
                            <button
                                onClick={() => {
                                    setEditHeadUnitName(currentHeadUnitName || headUnitName || '');
                                    setSignError('');
                                    setShowSignModal(true);
                                }}
                                className="flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
                                title="Buka form tanda tangan langsung untuk Kepala Unit"
                            >
                                <PenTool size={15} /> TTD Kepala Unit
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
                                {formatKopAddress(unitAddress)} {unitPhone ? `• Telp/WA: ${unitPhone}` : ''}
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
                                            const price = parseFloat(item.estPrice ?? item.estimatedPrice ?? item.price ?? item.finalPrice ?? item.unitPrice ?? item.harga ?? 0) || 0;
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
                                        {currentHeadUnitSig ? (
                                            <div className="flex flex-col items-center">
                                                <img
                                                    src={currentHeadUnitSig}
                                                    alt="TTD Kepala Unit"
                                                    className="max-h-20 max-w-[140px] object-contain"
                                                />
                                                {currentHeadUnitApprovedAt && (
                                                    <span className="text-[7.5pt] text-slate-400 italic">
                                                        {new Date(currentHeadUnitApprovedAt).toLocaleDateString('id-ID')}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <>
                                                {/* On screen: Tombol interaktif untuk TTD langsung Kepala Unit */}
                                                <div 
                                                    onClick={() => {
                                                        setEditHeadUnitName(currentHeadUnitName || headUnitName || '');
                                                        setSignError('');
                                                        setShowSignModal(true);
                                                    }}
                                                    className="no-print group border-2 border-dashed border-amber-400 hover:border-amber-600 bg-amber-50/80 hover:bg-amber-100/90 rounded-xl p-2.5 text-center cursor-pointer transition-all duration-200 shadow-xs hover:shadow-md w-full max-w-[180px]"
                                                    title="Klik untuk membuka pad tanda tangan langsung bagi Kepala Unit"
                                                >
                                                    <div className="flex items-center justify-center gap-1.5 text-amber-900 group-hover:text-amber-950 font-bold text-[8.5pt] font-sans">
                                                        <PenTool size={13} className="text-amber-600 group-hover:text-amber-700 group-hover:scale-110 transition-transform" />
                                                        <span>TTD Kepala Unit</span>
                                                    </div>
                                                    <span className="text-amber-700 group-hover:text-amber-900 text-[7.5pt] italic block leading-tight font-sans mt-0.5">
                                                        (Klik untuk Tanda Tangan)
                                                    </span>
                                                </div>

                                                {/* On print: Tampilan kotak menunggu standar saat dicetak */}
                                                <div className="hidden print:block border border-dashed border-amber-300 bg-amber-50/50 rounded-lg p-2 text-center w-full">
                                                    <Clock size={16} className="mx-auto text-amber-500 mb-0.5" />
                                                    <span className="text-amber-700 text-[8.5pt] italic block leading-tight font-sans">
                                                        Menunggu Persetujuan Kepala Unit
                                                    </span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-bold underline text-slate-900">{currentHeadUnitName || headUnitName || '(..........................)'}</p>
                                        <p className="text-slate-600 text-[9.5pt]">Kepala {unitName}</p>
                                    </div>
                                </div>

                                {/* Kolom 3: Diterima / Mengetahui: Kepala Bidang Sarana (TTE QR Code dengan Logo) */}
                                <div className="flex flex-col items-center justify-between min-h-[145px]">
                                    <div>
                                        <p className="font-medium">Diterima / Mengetahui,</p>
                                        <p className="font-bold text-slate-900 text-[10pt]">Bidang Sarana &amp; Prasarana</p>
                                    </div>
                                    <div className="my-1 flex items-center justify-center h-20 w-full">
                                        {kabidTte ? (
                                            <div className="flex flex-col items-center justify-center">
                                                <div className="relative p-1 bg-white border border-emerald-300 rounded-lg shadow-xs flex items-center justify-center">
                                                    <QRCode
                                                        value={`https://sarpras.dareliman.or.id/verify-doc?type=PERMOHONAN&no=${encodeURIComponent(letterNumber || '-')}&kabid=${encodeURIComponent(displayKabidName)}`}
                                                        size={56}
                                                        level="H"
                                                    />
                                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                        <div className="bg-white p-0.5 rounded border border-slate-200 shadow-xs flex items-center justify-center">
                                                            <img
                                                                src="/Sarpras.jpeg"
                                                                alt="Logo Bidang Sarana"
                                                                className="w-3.5 h-3.5 object-contain rounded-xs"
                                                                onError={(e) => { e.target.src = '/logo_yayasan.jpg'; }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-center font-sans mt-0.5">
                                                    <div className="flex items-center justify-center gap-0.5 text-emerald-700 font-bold text-[7pt]">
                                                        <ShieldCheck size={10} className="text-emerald-600 flex-shrink-0" />
                                                        <span>TERVERIFIKASI TTE</span>
                                                    </div>
                                                    {kabidTteAt && (
                                                        <span className="text-[6.5pt] text-slate-400 block leading-none">
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

            {/* Modal Popup Tanda Tangan Langsung Kepala Unit */}
            {showSignModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 my-auto">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-amber-600 to-amber-700 text-white">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/20 rounded-xl">
                                    <PenTool size={20} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-base">Tanda Tangan Kepala Unit</h4>
                                    <p className="text-xs text-amber-100">{unitName}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => !isSavingSign && setShowSignModal(false)}
                                disabled={isSavingSign}
                                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-white disabled:opacity-50"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-5 sm:p-6 space-y-4">
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                                <p className="font-bold">💡 Persetujuan Langsung Kepala Unit:</p>
                                <p className="mt-0.5 text-amber-800 leading-relaxed">
                                    Kepala Unit dapat langsung membubuhkan tanda tangan persetujuan pada Surat Permohonan ini di perangkat ini.
                                </p>
                            </div>

                            {signError && (
                                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                                    <AlertCircle size={16} className="shrink-0 text-rose-500" />
                                    <span>{signError}</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Nama Kepala Unit <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={editHeadUnitName}
                                    onChange={(e) => setEditHeadUnitName(e.target.value)}
                                    placeholder="Contoh: Apriko Putra"
                                    disabled={isSavingSign}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all disabled:opacity-60"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Goreskan Tanda Tangan <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <SignaturePad
                                        onSave={handleSaveHeadUnitSignature}
                                        onCancel={() => setShowSignModal(false)}
                                        title="Tanda Tangan Kepala Unit"
                                        storageKey={`saved_sig_head_${letterData?.unitId || 'unit'}`}
                                    />
                                    {isSavingSign && (
                                        <div className="absolute inset-0 bg-white/85 backdrop-blur-xs flex flex-col items-center justify-center gap-2 rounded-2xl z-10">
                                            <Loader2 size={32} className="animate-spin text-amber-600" />
                                            <span className="text-xs font-bold text-slate-700">Menyimpan persetujuan &amp; tanda tangan...</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProcurementLetterModal;
