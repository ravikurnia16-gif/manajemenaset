import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../lib/axios';
import { 
    CheckCircle2, AlertCircle, FileText, Building2, User, Calendar, 
    ShieldCheck, Clock, ArrowRight, Printer, Sparkles 
} from 'lucide-react';
import SignaturePad from '../components/SignaturePad';
import ProcurementLetterModal from '../components/ProcurementLetterModal';

const ProcurementHeadUnitApproval = () => {
    const { batchId } = useParams();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);

    const [headUnitName, setHeadUnitName] = useState('');
    const [signature, setSignature] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const [showLetterModal, setShowLetterModal] = useState(false);

    useEffect(() => {
        fetchApprovalData();
    }, [batchId]);

    const fetchApprovalData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get(`/procurements/public/head-unit-approval/${batchId}`);
            setData(res.data);
            if (res.data.letterData?.headUnitName) {
                setHeadUnitName(res.data.letterData.headUnitName);
            }
            if (res.data.isApproved) {
                setIsSuccess(true);
            }
        } catch (err) {
            console.error('Fetch approval error:', err);
            setError(err.response?.data?.error || 'Gagal memuat data permohonan pengadaan.');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSignature = async (sigDataUrl) => {
        if (!sigDataUrl) return;
        setSignature(sigDataUrl);

        if (!headUnitName.trim()) {
            alert('Nama Kepala Unit wajib diisi.');
            return;
        }

        setSubmitting(true);
        try {
            const res = await api.post(`/procurements/public/head-unit-approval/${batchId}`, {
                signature: sigDataUrl,
                headUnitName: headUnitName.trim()
            });

            setIsSuccess(true);
            // Refresh data
            fetchApprovalData();
        } catch (err) {
            console.error('Submit approval error:', err);
            alert(err.response?.data?.error || 'Gagal memproses persetujuan.');
        } finally {
            setSubmitting(false);
        }
    };

    const formatCurrency = (val) => {
        if (!val || isNaN(val)) return 'Rp 0';
        return `Rp ${Number(val).toLocaleString('id-ID')}`;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600 font-medium">Memuat data permohonan pengadaan...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl text-center border border-rose-100">
                    <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <AlertCircle size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Tautan Tidak Valid</h2>
                    <p className="text-slate-600 text-sm mb-6">{error}</p>
                    <p className="text-xs text-slate-400">Pastikan tautan yang Anda buka sesuai dengan pesan WhatsApp yang dikirimkan.</p>
                </div>
            </div>
        );
    }

    const { letterData, unit, requester } = data || {};
    const items = letterData?.items || [];
    const totalEstimate = items.reduce((acc, it) => {
        const p = parseFloat(it.estimatedPrice || it.price || 0) || 0;
        const q = parseFloat(it.qty || it.quantity || 1) || 1;
        return acc + (p * q);
    }, 0);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-blue-50/30 py-8 px-4 sm:px-6">
            <div className="max-w-3xl mx-auto space-y-6">
                
                {/* Header Branding */}
                <div className="text-center space-y-2">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-100 text-blue-800 text-xs font-bold uppercase tracking-wider">
                        <ShieldCheck size={14} /> SIMAS DAR EL-IMAN • PERSETUJUAN KEPALA UNIT
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
                        Surat Permohonan Pengadaan
                    </h1>
                    <p className="text-slate-600 text-sm">
                        Verifikasi dan tandatangani pengajuan kebutuhan sarana &amp; prasarana dari unit Anda.
                    </p>
                </div>

                {/* Status Card if Already Approved */}
                {isSuccess && (
                    <div className="bg-emerald-50 border-2 border-emerald-500/40 rounded-3xl p-6 text-center space-y-4 shadow-xl">
                        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                            <CheckCircle2 size={36} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-emerald-900">
                                Permohonan Telah Disetujui!
                            </h2>
                            <p className="text-sm text-emerald-800 mt-1 max-w-md mx-auto">
                                Tanda tangan Anda telah dibubuhkan. Notifikasi resmi telah dikirimkan secara otomatis kepada <b>Kepala Bidang Sarana</b> dan <b>Staff Manajemen Aset</b> untuk diproses lebih lanjut.
                            </p>
                        </div>

                        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                            <button
                                onClick={() => setShowLetterModal(true)}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-2xl shadow-lg shadow-emerald-600/20 transition-all"
                            >
                                <Printer size={16} /> Lihat / Cetak Surat Permohonan
                            </button>
                        </div>
                    </div>
                )}

                {/* Surat Overview Card */}
                <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
                    <div className="bg-slate-900 text-white p-6 sm:p-7 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider block mb-1">
                                Nomor Surat Permohonan:
                            </span>
                            <h3 className="text-xl sm:text-2xl font-black tracking-tight font-mono text-white">
                                {letterData?.letterNumber || '-'}
                            </h3>
                            <p className="text-slate-400 text-xs mt-1">
                                Perihal: <span className="text-slate-200 font-semibold">{letterData?.title || 'Pengadaan Barang'}</span>
                            </p>
                        </div>
                        <div className="text-left sm:text-right">
                            <span className="text-xs text-slate-400 block">Unit Pemohon</span>
                            <span className="font-bold text-base text-blue-200">{unit?.name || letterData?.unitName}</span>
                            <span className="block text-[11px] text-slate-400 mt-0.5">
                                {new Date(letterData?.createdAt || Date.now()).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </span>
                        </div>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Meta info grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <div>
                                <span className="text-xs text-slate-500 font-semibold block mb-0.5">Yang Mengajukan (Pemohon):</span>
                                <p className="font-bold text-slate-800">{letterData?.requesterName || requester?.name || requester?.username}</p>
                                <p className="text-xs text-slate-500">{letterData?.requesterPosition || 'Staff Unit'}</p>
                            </div>
                            <div>
                                <span className="text-xs text-slate-500 font-semibold block mb-0.5">Total Rincian Item:</span>
                                <p className="font-bold text-slate-800">{items.length} Item Barang</p>
                                {totalEstimate > 0 && (
                                    <p className="text-xs text-emerald-600 font-bold mt-0.5">Total Estimasi: {formatCurrency(totalEstimate)}</p>
                                )}
                            </div>
                        </div>

                        {/* Items Table */}
                        <div>
                            <h4 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
                                <FileText size={16} className="text-blue-600" />
                                Rincian Barang yang Dimohonkan:
                            </h4>
                            <div className="overflow-x-auto rounded-2xl border border-slate-200">
                                <table className="w-full text-left text-xs sm:text-sm">
                                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                                        <tr>
                                            <th className="px-3 py-2.5 w-10 text-center">No</th>
                                            <th className="px-3 py-2.5">Nama Barang</th>
                                            <th className="px-3 py-2.5 text-center">Jumlah</th>
                                            <th className="px-3 py-2.5 text-right">Est. Harga</th>
                                            <th className="px-3 py-2.5">Spesifikasi / Keperluan</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {items.map((it, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50">
                                                <td className="px-3 py-2 text-center text-slate-500">{idx + 1}</td>
                                                <td className="px-3 py-2 font-bold text-slate-800">{it.name}</td>
                                                <td className="px-3 py-2 text-center font-semibold text-slate-700">
                                                    {it.qty} {it.unit}
                                                </td>
                                                <td className="px-3 py-2 text-right text-slate-600">
                                                    {it.estimatedPrice ? formatCurrency(it.estimatedPrice) : '-'}
                                                </td>
                                                <td className="px-3 py-2 text-slate-500 text-xs">
                                                    {it.spec || '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Notes if any */}
                        {letterData?.notes && (
                            <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-2xl text-xs sm:text-sm">
                                <span className="font-bold text-amber-900 block mb-1">Catatan Pemohon:</span>
                                <p className="text-amber-800 whitespace-pre-line">{letterData.notes}</p>
                            </div>
                        )}

                        {/* Signature Action Section (Only if not yet approved) */}
                        {!isSuccess && (
                            <div className="pt-4 border-t border-slate-200 space-y-5">
                                <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl">
                                    <h4 className="font-bold text-blue-900 text-sm mb-1 flex items-center gap-1.5">
                                        <Sparkles size={16} className="text-blue-600" />
                                        Form Tanda Tangan Kepala Unit
                                    </h4>
                                    <p className="text-xs text-blue-800">
                                        Pastikan data nama Anda sudah sesuai. Anda dapat menyimpan tanda tangan ini agar otomatis tersedia di pengajuan unit berikutnya.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                        Nama Lengkap Kepala Unit *
                                    </label>
                                    <input
                                        type="text"
                                        value={headUnitName}
                                        onChange={(e) => setHeadUnitName(e.target.value)}
                                        placeholder="Contoh: Ustadz Ahmad, S.Pd.I"
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                                        Bubuhkan Tanda Tangan Anda *
                                    </label>
                                    <SignaturePad
                                        title="Tanda Tangan Kepala Unit"
                                        storageKey={`head_unit_signature_${unit?.id || 'default'}`}
                                        onSave={handleSaveSignature}
                                    />
                                </div>

                                {signature && (
                                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-16 h-12 bg-white rounded border border-emerald-300 p-1 flex items-center justify-center">
                                                <img src={signature} alt="TTD Preview" className="max-h-full max-w-full object-contain" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-emerald-900">Tanda Tangan Terpilih</p>
                                                <p className="text-[11px] text-emerald-700">Siap dikirimkan bersama dokumen persetujuan.</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setSignature(null)}
                                            className="text-xs text-rose-600 font-bold hover:underline"
                                        >
                                            Ubah TTD
                                        </button>
                                    </div>
                                )}

                                <div className="pt-2">
                                    <button
                                        type="button"
                                        disabled={!signature || submitting}
                                        onClick={handleSubmitApproval}
                                        className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-xl transition-all ${
                                            !signature || submitting
                                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                                                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/25'
                                        }`}
                                    >
                                        {submitting ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                Menyimpan &amp; Mengirimkan...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 size={18} />
                                                Tandatangani &amp; Teruskan ke Bidang Sarana
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Footer preview button */}
                        <div className="pt-4 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100">
                            <span>Sistem Informasi Manajemen Aset &amp; Sarpras (SIMAS)</span>
                            <button
                                onClick={() => setShowLetterModal(true)}
                                className="text-blue-600 font-bold hover:underline flex items-center gap-1"
                            >
                                <Printer size={13} /> Pratinjau Surat Resmi
                            </button>
                        </div>
                    </div>
                </div>

            </div>

            {/* Letter Print / Preview Modal */}
            <ProcurementLetterModal
                isOpen={showLetterModal}
                onClose={() => setShowLetterModal(false)}
                letterData={{
                    ...letterData,
                    headUnitName: headUnitName || letterData?.headUnitName,
                    headUnitSignature: signature || letterData?.headUnitSignature
                }}
            />
        </div>
    );
};

export default ProcurementHeadUnitApproval;
