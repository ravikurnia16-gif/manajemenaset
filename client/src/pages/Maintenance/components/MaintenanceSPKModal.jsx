import React, { useState, useEffect, useRef } from 'react';
import { Printer, X, ShieldCheck, Check, Save, AlertCircle, FileCheck } from 'lucide-react';
import QRCode from 'react-qr-code';
import api from '../../../lib/axios';

/* ─── Helpers ─── */
const categoryMap = { 
    ROUTINE: 'Pemeliharaan Rutin', 
    INCIDENT: 'Pemeliharaan Insidentil',
    INCIDENTAL: 'Pemeliharaan Insidentil' 
};

const toRoman = (n) => {
    const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
    const syms = ['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I'];
    let out = '';
    vals.forEach((v, i) => { while (n >= v) { out += syms[i]; n -= v; } });
    return out;
};

const formatDate = (d) => {
    if (!d) return '—';
    const dt = new Date(d);
    return dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

const formatDateShort = (d) => {
    if (!d) return '—';
    const dt = new Date(d);
    return dt.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/* ─── Resolve "Pemberi Tugas" (strictly "Bidang Sarana", no "Prasarana") ─── */
const getPemberiTugas = (currentUser, spkData) => {
    if (spkData?.signedBy) {
        return {
            name: spkData.signedBy,
            position: spkData.signedByPosition || 'Kepala Bidang Sarana',
            org: 'Bidang Sarana — Yayasan Dar El-Iman Padang',
            nip: spkData.signedByNip || '—',
        };
    }

    const activeUser = currentUser || (typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {});
    if (activeUser && (activeUser.name || activeUser.username)) {
        return {
            name: activeUser.name || activeUser.username || 'Ravi Kurnia, S.T.',
            position: activeUser.position || 'Kepala Bidang Sarana',
            org: 'Bidang Sarana — Yayasan Dar El-Iman Padang',
            nip: activeUser.nip || activeUser.employeeId || '—',
        };
    }

    return {
        name: 'Ravi Kurnia, S.T.',
        position: 'Kepala Bidang Sarana',
        org: 'Bidang Sarana — Yayasan Dar El-Iman Padang',
        nip: '—',
    };
};

/* ═══════════════════════════════════════════════════════════
   QR TTE Stamp Component (Compact for Single-Page A4)
══════════════════════════════════════════════════════════ */
const TTEStamp = ({ pemberiTugas, spkData, report }) => {
    const docUuid = spkData?.documentUuid || report?.code || 'SPK';
    const verifyUrl = `https://sarpras.dareliman.or.id/verify/${docUuid}`;
    const signedAt = spkData?.signedAt || new Date().toISOString();

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            padding: '6px 12px',
            background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
            border: '1.2px solid #86efac',
            borderRadius: 8,
            minWidth: 150,
        }}>
            {/* TTE Header */}
            <div style={{
                fontSize: 7.5, fontWeight: 800, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: '#15803d',
                display: 'flex', alignItems: 'center', gap: 3
            }}>
                <span>✦</span> TTE ELEKTRONIK <span>✦</span>
            </div>

            {/* QR Code with centered logo */}
            <div style={{ position: 'relative', display: 'inline-block' }}>
                <QRCode
                    value={verifyUrl}
                    size={54}
                    level="H"
                    style={{ display: 'block' }}
                />
                <div style={{
                    position: 'absolute',
                    top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: '#fff',
                    borderRadius: 3,
                    padding: 1.5,
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 14, height: 14,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.15)'
                }}>
                    <img
                        src="/Sarpras.jpeg"
                        alt="Bidang Sarana"
                        style={{ width: 11, height: 11, objectFit: 'contain', borderRadius: 2 }}
                        onError={(e) => { e.target.src = '/logo_yayasan.jpg'; }}
                    />
                </div>
            </div>

            {/* Signed info */}
            <div style={{ fontSize: 7, color: '#166534', textAlign: 'center', lineHeight: 1.3 }}>
                <div style={{ fontWeight: 700 }}>{pemberiTugas.name}</div>
                <div style={{ fontWeight: 500 }}>{formatDateShort(signedAt)}</div>
                <div style={{ fontWeight: 500, color: '#4b5563', fontFamily: 'monospace', fontSize: 6.5 }}>
                    {spkData?.documentNumber || report?.code || 'SPK'}
                </div>
            </div>

            {/* Validity badge */}
            <div style={{
                fontSize: 6.5, fontWeight: 800,
                background: '#15803d', color: '#fff',
                borderRadius: 3, padding: '1px 5px',
                letterSpacing: '0.05em'
            }}>
                SAH ELEKTRONIK
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════
   MAIN MODAL
══════════════════════════════════════════════════════════ */
export default function MaintenanceSPKModal({ show, onClose, report, currentUser, onReportUpdated }) {
    const printRef = useRef(null);

    // State data SPK dari E-Office
    const [spkData, setSpkData] = useState(null);
    const [loadingSpk, setLoadingSpk] = useState(false);
    const [savingSpk, setSavingSpk] = useState(false);
    const [signingTte, setSigningTte] = useState(false);
    const [cancellingTte, setCancellingTte] = useState(false);
    const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', text: '' }

    // Input form pemberi tugas
    const [maintenanceType, setMaintenanceType] = useState('Pemeliharaan Aset');
    const [targetEndDate, setTargetEndDate] = useState('');
    const [scopeText, setScopeText] = useState('');

    // Fetch SPK & E-Office data when modal opens
    useEffect(() => {
        if (show && report?.id) {
            loadSPKData();
        } else {
            setFeedback(null);
        }
    }, [show, report?.id]);

    const loadSPKData = async () => {
        try {
            setLoadingSpk(true);
            setFeedback(null);
            const res = await api.get(`/maintenance/${report.id}/spk`);
            const { spk } = res.data;
            setSpkData(spk);

            // Populate form values
            const defaultType = report.targetDept === 'PEMBANGUNAN' ? 'Pemeliharaan Bangunan' : 'Pemeliharaan Aset';
            setMaintenanceType(spk?.maintenanceType || defaultType);
            setTargetEndDate(spk?.targetEndDate ? spk.targetEndDate.substring(0, 10) : '');
            setScopeText(spk?.scopeText || (report.description || report.title || '').trim());
        } catch (err) {
            console.error('Failed to load SPK details:', err);
            // Fallback default
            const defaultType = report?.targetDept === 'PEMBANGUNAN' ? 'Pemeliharaan Bangunan' : 'Pemeliharaan Aset';
            setMaintenanceType(defaultType);
            setScopeText((report?.description || report?.title || '').trim());
        } finally {
            setLoadingSpk(false);
        }
    };

    if (!show || !report) return null;

    // Resolusi User & Hak Akses TTE
    const activeUser = currentUser || (typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {});
    const userPosition = (activeUser?.position || '').toLowerCase();
    const userRole = activeUser?.role || '';
    const isKabidSarana = userPosition.includes('kepala bidang sarana') || userRole === 'SUPER_ADMIN';

    const isPembangunan = report.targetDept === 'PEMBANGUNAN';
    const pemberiTugas = getPemberiTugas(activeUser, spkData);

    // Nomor Dokumen E-Office pattern: {URUT}/SPK/SRN/{BULAN_ROMAWI}/{TAHUN}
    const d = new Date(report.createdAt || Date.now());
    const fallbackNumber = `001/SPK/SRN/${toRoman(d.getMonth() + 1)}/${d.getFullYear()}`;
    const spkNumber = spkData?.documentNumber || fallbackNumber;

    // Kategori murni (tanpa urgensi)
    const pureCategory = categoryMap[report.category] || report.category || 'Pemeliharaan Rutin';

    // Derive scope numbered list items
    const scopeLines = (scopeText || '').split('\n').map(l => l.trim()).filter(Boolean);

    // Tanggal target
    const displayEndDate = targetEndDate
        ? formatDate(targetEndDate)
        : '[Tanggal Target Selesai]';

    /* ─── Handlers ─── */
    const handlePrint = () => {
        window.print();
    };

    const handleSaveDraft = async () => {
        try {
            setSavingSpk(true);
            setFeedback(null);
            const res = await api.put(`/maintenance/${report.id}/spk`, {
                maintenanceType,
                targetEndDate: targetEndDate || null,
                scopeText,
            });
            setSpkData(prev => ({
                ...(prev || {}),
                maintenanceType,
                targetEndDate,
                scopeText,
            }));
            setFeedback({ type: 'success', text: res.data?.message || 'Rincian SPK berhasil disimpan.' });
        } catch (err) {
            console.error('Error saving SPK draft:', err);
            setFeedback({ type: 'error', text: err.response?.data?.error || 'Gagal menyimpan draft SPK.' });
        } finally {
            setSavingSpk(false);
        }
    };

    const handleSignTte = async () => {
        if (!isKabidSarana) {
            setFeedback({
                type: 'error',
                text: 'Hak akses ditolak: Hanya Kepala Bidang Sarana yang berwenang membubuhkan TTE.'
            });
            return;
        }

        try {
            setSigningTte(true);
            setFeedback(null);
            const res = await api.post(`/maintenance/${report.id}/spk/tte`, {
                maintenanceType,
                targetEndDate: targetEndDate || null,
                scopeText,
            });
            setSpkData(res.data.spk);
            setFeedback({
                type: 'success',
                text: res.data?.message || 'TTE berhasil dibubuhkan dan dokumen terdaftar di E-Office Surat Keluar!'
            });
            if (onReportUpdated) {
                onReportUpdated();
            }
        } catch (err) {
            console.error('Error signing SPK TTE:', err);
            setFeedback({
                type: 'error',
                text: err.response?.data?.error || 'Gagal membubuhkan TTE pada SPK.'
            });
        } finally {
            setSigningTte(false);
        }
    };

    const handleCancelTte = async () => {
        if (!isKabidSarana) return;
        if (!window.confirm('Batalkan TTE resmi pada SPK ini? Dokumen akan kembali berstatus DRAFT.')) return;

        try {
            setCancellingTte(true);
            setFeedback(null);
            const res = await api.delete(`/maintenance/${report.id}/spk/tte`);
            setSpkData(prev => ({
                ...(prev || {}),
                isSigned: false,
                status: 'DRAFT',
                signedAt: null,
                signedBy: null,
            }));
            setFeedback({ type: 'success', text: res.data?.message || 'TTE SPK berhasil dibatalkan.' });
            if (onReportUpdated) {
                onReportUpdated();
            }
        } catch (err) {
            console.error('Error cancelling SPK TTE:', err);
            setFeedback({
                type: 'error',
                text: err.response?.data?.error || 'Gagal membatalkan TTE.'
            });
        } finally {
            setCancellingTte(false);
        }
    };

    return (
        <>
            {/* ── Strict A4 Single-Page Print CSS ── */}
            <style>{`
                @media print {
                    body > * { display: none !important; }
                    #spk-printable-wrapper { display: block !important; }
                    #spk-printable-wrapper * { visibility: visible !important; }
                    #spk-printable-wrapper {
                        position: fixed !important;
                        inset: 0 !important;
                        width: 100% !important;
                        height: auto !important;
                        overflow: visible !important;
                        background: white !important;
                        z-index: 99999 !important;
                    }
                    #spk-printable {
                        width: 100% !important;
                        padding: 8mm 14mm 8mm 14mm !important;
                        font-size: 9.5pt !important;
                        line-height: 1.35 !important;
                        background: white !important;
                        color: #111 !important;
                        overflow: visible !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .no-print { display: none !important; }
                    .spk-sig-block {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    .spk-keep-together {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    @page {
                        size: A4 portrait;
                        margin: 0;
                    }
                }
            `}</style>

            {/* ── Modal Backdrop ── */}
            <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4"
                onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            >
                <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[96vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">

                    {/* ── Top Header Bar ── */}
                    <div className="no-print p-4 border-b border-slate-200 bg-slate-900 text-white flex justify-between items-center flex-wrap gap-2">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-blue-600/30 border border-blue-500/40 rounded-xl text-blue-400">
                                <Printer size={18} />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm tracking-tight">Surat Perintah Kerja (SPK) Pemeliharaan</h3>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[11px] font-mono text-blue-300 font-semibold">{spkNumber}</span>
                                    {spkData?.isSigned ? (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                            <ShieldCheck size={11} /> Terhubung E-Office &amp; TTE Sah
                                        </span>
                                    ) : (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                            Draft SPK (Belum TTE)
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={handlePrint}
                                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                            >
                                <Printer size={14} /> Cetak / Ekspor PDF A4
                            </button>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* ── Notification Feedback Alert ── */}
                    {feedback && (
                        <div className={`no-print px-4 py-2.5 text-xs font-semibold flex items-center justify-between border-b ${
                            feedback.type === 'success' 
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                                : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}>
                            <div className="flex items-center gap-2">
                                {feedback.type === 'success' ? <Check size={15} className="text-emerald-600" /> : <AlertCircle size={15} className="text-rose-600" />}
                                <span>{feedback.text}</span>
                            </div>
                            <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600 text-xs">Tutup</button>
                        </div>
                    )}

                    {/* ── Pemberi Tugas Control Panel (No-Print) ── */}
                    <div className="no-print p-3.5 bg-slate-50 border-b border-slate-200 text-slate-700">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                            <span>⚙️</span> Pengaturan &amp; Masukan Pemberi Tugas (Kepala Bidang Sarana)
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                            {/* 1. Jenis Pemeliharaan */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                    Jenis Pemeliharaan:
                                </label>
                                <select
                                    value={maintenanceType}
                                    onChange={(e) => setMaintenanceType(e.target.value)}
                                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="Pemeliharaan Aset">Pemeliharaan Aset</option>
                                    <option value="Pemeliharaan Bangunan">Pemeliharaan Bangunan</option>
                                    <option value="Pemeliharaan Fasilitas">Pemeliharaan Fasilitas</option>
                                </select>
                            </div>

                            {/* 2. Tanggal Pengerjaan Selesai */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                    Tanggal Pengerjaan Selesai:
                                </label>
                                <input
                                    type="date"
                                    value={targetEndDate}
                                    onChange={(e) => setTargetEndDate(e.target.value)}
                                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* 3. TTE & Save Actions */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleSaveDraft}
                                    disabled={savingSpk}
                                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                    title="Simpan perubahan rincian tanpa TTE"
                                >
                                    <Save size={13} /> {savingSpk ? 'Menyimpan...' : 'Simpan Draft'}
                                </button>

                                {spkData?.isSigned ? (
                                    isKabidSarana && (
                                        <button
                                            onClick={handleCancelTte}
                                            disabled={cancellingTte}
                                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                                        >
                                            {cancellingTte ? 'Membatalkan...' : 'Batalkan TTE'}
                                        </button>
                                    )
                                ) : (
                                    <button
                                        onClick={handleSignTte}
                                        disabled={signingTte || !isKabidSarana}
                                        className={`flex-1 px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer ${
                                            isKabidSarana
                                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                        }`}
                                        title={isKabidSarana ? 'Bubuhkan TTE resmi Kepala Bidang Sarana' : 'Hanya Kepala Bidang Sarana yang berhak'}
                                    >
                                        <ShieldCheck size={14} />
                                        {signingTte ? 'Membubuhkan TTE...' : '✦ Bubuhkan TTE (Kabid Sarana) ✦'}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Rincian Pengerjaan Textarea */}
                        <div className="mt-2.5">
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                                    <span>Rincian Pengerjaan (Scope of Work dari Pemberi Tugas):</span>
                                </label>
                                <span className="text-[10px] text-slate-500 italic">Tiap baris Enter akan menjadi 1 nomor rincian pada cetakan</span>
                            </div>
                            <textarea
                                value={scopeText}
                                onChange={(e) => setScopeText(e.target.value)}
                                rows={2}
                                placeholder="Tuliskan rincian pengerjaan / instruksi khusus pelaksana di sini..."
                                className="w-full text-xs font-serif bg-white border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed resize-y"
                            />
                        </div>
                    </div>

                    {/* ── Printable Document Body ── */}
                    <div id="spk-printable-wrapper" className="flex-1 overflow-y-auto">
                        <div
                            id="spk-printable"
                            ref={printRef}
                            style={{
                                padding: '24px 32px',
                                fontFamily: "'Times New Roman', Times, serif",
                                fontSize: 11.5,
                                color: '#111',
                                lineHeight: 1.45,
                                background: '#fff',
                            }}
                        >
                            {/* ══ KOP SURAT (Tanpa "SISTEM INFORMASI SARPRAS" & Tanpa "Prasarana") ══ */}
                            <div style={{
                                borderBottom: '2.5px solid #111',
                                paddingBottom: 6,
                                marginBottom: 10,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                            }}>
                                <div style={{ flexShrink: 0 }}>
                                    <img
                                        src="/logo_yayasan.jpg"
                                        alt="Logo Yayasan"
                                        style={{ width: 50, height: 50, objectFit: 'contain' }}
                                        onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                </div>
                                <div style={{ flex: 1, textAlign: 'center' }}>
                                    <div style={{
                                        fontSize: 14,
                                        fontWeight: 900,
                                        fontFamily: 'Arial, sans-serif',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.04em',
                                        lineHeight: 1.2
                                    }}>
                                        YAYASAN DAR EL-IMAN
                                    </div>
                                    <div style={{
                                        fontSize: 11.5,
                                        fontWeight: 700,
                                        fontFamily: 'Arial, sans-serif',
                                        textTransform: 'uppercase',
                                        color: '#111',
                                        marginTop: 1,
                                        lineHeight: 1.2
                                    }}>
                                        {isPembangunan ? 'BIDANG PEMBANGUNAN & PENGEMBANGAN' : 'BIDANG SARANA'}
                                    </div>
                                    <div style={{
                                        fontSize: 8.5,
                                        color: '#333',
                                        fontFamily: 'Arial, sans-serif',
                                        marginTop: 2,
                                        lineHeight: 1.2
                                    }}>
                                        Jl. Gunung Juaro RT.02 RW.04, Kel. Surau Gadang, Kec. Nanggalo, Kota Padang — Sumatera Barat
                                    </div>
                                </div>
                                <div style={{ flexShrink: 0, width: 50 }} />
                            </div>

                            {/* ══ JUDUL DOKUMEN & NOMOR SURAT E-OFFICE ══ */}
                            <div style={{ textAlign: 'center', marginBottom: 12 }}>
                                <div style={{
                                    fontFamily: 'Arial, sans-serif',
                                    fontSize: 13,
                                    fontWeight: 900,
                                    textTransform: 'uppercase',
                                    textDecoration: 'underline',
                                    letterSpacing: '0.04em'
                                }}>
                                    SURAT PERINTAH KERJA (SPK)
                                </div>
                                <div style={{
                                    fontFamily: "'Courier New', monospace",
                                    fontSize: 10,
                                    fontWeight: 700,
                                    marginTop: 2
                                }}>
                                    Nomor: {spkNumber}
                                </div>
                            </div>

                            {/* ══ PEMBUKA ══ */}
                            <p style={{ marginBottom: 8, textAlign: 'justify', fontSize: 10.5, lineHeight: 1.4 }}>
                                Berdasarkan laporan permohonan pemeliharaan yang telah diverifikasi, Bidang Sarana Yayasan Dar el-Iman dengan ini menerbitkan perintah kerja kepada:
                            </p>

                            {/* ══ DATA TEKNISI / PELAKSANA (Tanpa Alamat Vendor, No HP Valid) ══ */}
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10, fontSize: 10.5 }}>
                                <tbody>
                                    {[
                                        ['Nama Petugas / Vendor', report.technician || report.technicianName || '[Nama Teknisi Internal / Vendor]'],
                                        ['Status Pelaksana', report.technicianType === 'external' || report.isExternal ? 'Eksternal Yayasan' : 'Internal Yayasan'],
                                        ['Kontak / No. HP', report.technicianPhone || (report.user?.phone) || '-'],
                                    ].map(([label, val]) => (
                                        <tr key={label}>
                                            <td style={{ paddingTop: 2, paddingBottom: 2, width: '32%', verticalAlign: 'top', paddingRight: 6 }}>
                                                <strong>{label}</strong>
                                            </td>
                                            <td style={{ paddingTop: 2, paddingBottom: 2, verticalAlign: 'top' }}>
                                                : {val}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* ══ DETAIL PEKERJAAN & LOKASI (Jenis Berdasarkan Input, Kategori Murni Saja) ══ */}
                            <div style={{ marginBottom: 10 }}>
                                <div style={{
                                    fontFamily: 'Arial, sans-serif',
                                    fontWeight: 800,
                                    fontSize: 10,
                                    textTransform: 'uppercase',
                                    borderBottom: '1px solid #333',
                                    paddingBottom: 2,
                                    marginBottom: 5,
                                    letterSpacing: '0.04em'
                                }}>
                                    Detail Pekerjaan &amp; Lokasi
                                </div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9.5, border: '1px solid #888' }}>
                                    <thead>
                                        <tr style={{ background: '#1e3a5f', color: '#fff' }}>
                                            <th style={{ padding: '3px 8px', width: '32%', textAlign: 'left', border: '1px solid #888', fontFamily: 'Arial, sans-serif', fontWeight: 700 }}>Parameter</th>
                                            <th style={{ padding: '3px 8px', textAlign: 'left', border: '1px solid #888', fontFamily: 'Arial, sans-serif', fontWeight: 700 }}>Keterangan</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[
                                            ['Jenis Pemeliharaan', maintenanceType],
                                            ['Kategori', pureCategory],
                                            ['Unit / Lokasi Kerja', report.unit?.name || report.location || '-'],
                                            ['Nama Aset / Sasaran', report.assets && report.assets.length > 0
                                                ? report.assets.map(a => `${a.code} (${a.name})`).join('; ')
                                                : (report.location || report.title || '-')
                                            ],
                                            ['Tanggal Pengerjaan', `${formatDate(report.createdAt)} s.d. ${displayEndDate}`],
                                        ].map(([label, val], i) => (
                                            <tr key={label} style={{ background: i % 2 === 0 ? '#f8f9fa' : '#fff' }}>
                                                <td style={{ padding: '3px 8px', border: '1px solid #ccc', fontWeight: 600, verticalAlign: 'top' }}>{label}</td>
                                                <td style={{ padding: '3px 8px', border: '1px solid #ccc', verticalAlign: 'top' }}>{val}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* ══ URAIAN LINGKUP PEKERJAAN (Dari Pemberi Tugas) ══ */}
                            <div style={{ marginBottom: 10 }}>
                                <div style={{
                                    fontFamily: 'Arial, sans-serif',
                                    fontWeight: 800,
                                    fontSize: 10,
                                    textTransform: 'uppercase',
                                    borderBottom: '1px solid #333',
                                    paddingBottom: 2,
                                    marginBottom: 5,
                                    letterSpacing: '0.04em'
                                }}>
                                    Uraian Lingkup Pekerjaan (Scope of Work)
                                </div>
                                <ol style={{ margin: 0, paddingLeft: 18, fontSize: 10, lineHeight: 1.4 }}>
                                    {scopeLines.length > 0 ? (
                                        scopeLines.map((item, i) => (
                                            <li key={i} style={{ marginBottom: 2 }}>{item}</li>
                                        ))
                                    ) : (
                                        <li style={{ color: '#555', fontStyle: 'italic' }}>
                                            Melaksanakan tindakan perbaikan dan pemeliharaan sesuai kendala yang dilaporkan hingga berfungsi baik kembali.
                                        </li>
                                    )}
                                </ol>
                            </div>

                            {/* ══ KETENTUAN PELAKSANAAN (Ringkas Agar Tidak Berlebih Halaman) ══ */}
                            <div style={{ marginBottom: 10 }}>
                                <div style={{
                                    fontFamily: 'Arial, sans-serif',
                                    fontWeight: 800,
                                    fontSize: 10,
                                    textTransform: 'uppercase',
                                    borderBottom: '1px solid #333',
                                    paddingBottom: 2,
                                    marginBottom: 5,
                                    letterSpacing: '0.04em'
                                }}>
                                    Ketentuan Pelaksanaan
                                </div>
                                <ol style={{ margin: 0, paddingLeft: 18, fontSize: 9.5, lineHeight: 1.4 }}>
                                    <li style={{ marginBottom: 2 }}>
                                        <strong>Kualitas &amp; Keselamatan:</strong> Pelaksana wajib bekerja sesuai standar teknis mutu Yayasan dan mengutamakan keselamatan kerja.
                                    </li>
                                    <li style={{ marginBottom: 2 }}>
                                        <strong>Pembaruan Progres:</strong> Pelaksana wajib melaporkan tahapan pelaksanaan dan berkoordinasi aktif dengan Bidang Sarana.
                                    </li>
                                    <li style={{ marginBottom: 2 }}>
                                        <strong>Penyelesaian:</strong> Setelah pengerjaan selesai, pelaksana wajib melakukan uji fungsi bersama pemohon dan menyelesaikan Berita Acara Serah Terima (BAST).
                                    </li>
                                </ol>
                            </div>

                            {/* ══ DAFTAR ASET (Hanya tampil jika ada aset) ══ */}
                            {report.assets && report.assets.length > 0 && (
                                <div style={{ marginBottom: 10 }}>
                                    <div style={{
                                        fontFamily: 'Arial, sans-serif',
                                        fontWeight: 800,
                                        fontSize: 10,
                                        textTransform: 'uppercase',
                                        borderBottom: '1px solid #333',
                                        paddingBottom: 2,
                                        marginBottom: 5,
                                        letterSpacing: '0.04em'
                                    }}>
                                        Daftar Aset Terkait
                                    </div>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9, border: '1px solid #ccc' }}>
                                        <thead>
                                            <tr style={{ background: '#1e3a5f', color: '#fff' }}>
                                                <th style={{ padding: '3px 6px', border: '1px solid #888', fontFamily: 'Arial, sans-serif', width: 25, textAlign: 'center' }}>No</th>
                                                <th style={{ padding: '3px 6px', border: '1px solid #888', fontFamily: 'Arial, sans-serif', width: '28%' }}>Kode Aset</th>
                                                <th style={{ padding: '3px 6px', border: '1px solid #888', fontFamily: 'Arial, sans-serif' }}>Nama Aset</th>
                                                <th style={{ padding: '3px 6px', border: '1px solid #888', fontFamily: 'Arial, sans-serif', width: '22%' }}>Kondisi Awal</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {report.assets.map((a, i) => (
                                                <tr key={a.id || i} style={{ background: i % 2 === 0 ? '#f8f9fa' : '#fff' }}>
                                                    <td style={{ padding: '2px 6px', border: '1px solid #ccc', textAlign: 'center' }}>{i + 1}</td>
                                                    <td style={{ padding: '2px 6px', border: '1px solid #ccc', fontFamily: 'monospace', fontWeight: 700, color: '#1d4ed8' }}>{a.code}</td>
                                                    <td style={{ padding: '2px 6px', border: '1px solid #ccc' }}>{a.name}</td>
                                                    <td style={{ padding: '2px 6px', border: '1px solid #ccc' }}>{a.condition || 'BAIK'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* ══ PENUTUP & TTE DALAM SATU CONTAINER ANTI-BREAK ══ */}
                            <div className="spk-keep-together" style={{ pageBreakInside: 'avoid', breakInside: 'avoid', marginTop: 6 }}>
                                <p style={{ marginBottom: 12, fontSize: 10, textAlign: 'justify', lineHeight: 1.4 }}>
                                    Demikian Surat Perintah Kerja ini diterbitkan untuk dilaksanakan dengan penuh rasa tanggung jawab.
                                </p>

                                {/* ══ TANDA TANGAN PEMBERI TUGAS ══ */}
                                <div
                                    className="spk-sig-block"
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'flex-end',
                                        pageBreakInside: 'avoid',
                                        breakInside: 'avoid',
                                    }}
                                >
                                    <div style={{
                                        textAlign: 'center',
                                        minWidth: 200,
                                        fontSize: 10.5,
                                        fontFamily: "'Times New Roman', Times, serif"
                                    }}>
                                        {/* Tanggal & Tempat */}
                                        <div style={{ marginBottom: 2 }}>
                                            Padang, {formatDate(spkData?.signedAt || report.approvedAt || report.createdAt || new Date())}
                                        </div>
                                        <div style={{ marginBottom: 6, fontWeight: 700 }}>
                                            Pemberi Tugas,
                                        </div>

                                        {/* TTE Box or Placeholder */}
                                        <div style={{ minHeight: 76, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                            {spkData?.isSigned ? (
                                                <>
                                                    <TTEStamp
                                                        pemberiTugas={pemberiTugas}
                                                        spkData={spkData}
                                                        report={report}
                                                    />
                                                    <div style={{
                                                        marginTop: 3,
                                                        fontSize: 7,
                                                        color: '#15803d',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 3,
                                                        fontWeight: 600
                                                    }}>
                                                        <span>✓</span> Tercatat di E-Office Surat Keluar
                                                    </div>
                                                </>
                                            ) : (
                                                <div style={{
                                                    width: 140,
                                                    height: 64,
                                                    border: '1.2px dashed #94a3b8',
                                                    borderRadius: 6,
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: '#64748b',
                                                    fontSize: 8.5,
                                                    fontStyle: 'italic',
                                                    background: '#f8fafc',
                                                    padding: 4,
                                                    textAlign: 'center'
                                                }}>
                                                    <span>Menunggu TTE</span>
                                                    <span style={{ fontSize: 7.5, color: '#94a3b8' }}>Kepala Bidang Sarana</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Identitas Pemberi Tugas */}
                                        <div style={{ borderTop: '1px solid #222', paddingTop: 3, marginTop: 6 }}>
                                            <div style={{ fontWeight: 800, fontSize: 11 }}>
                                                <strong><u>{pemberiTugas.name}</u></strong>
                                            </div>
                                            <div style={{ fontSize: 9.5, color: '#333' }}>
                                                {pemberiTugas.position}
                                            </div>
                                            <div style={{ fontSize: 8.5, color: '#555' }}>
                                                {pemberiTugas.org}
                                            </div>
                                            {pemberiTugas.nip && pemberiTugas.nip !== '—' && (
                                                <div style={{ fontSize: 8.5, color: '#555', fontFamily: 'monospace' }}>
                                                    NIY / NIP: {pemberiTugas.nip}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ══ FOOTER INFORMASI DOKUMEN ══ */}
                            <div style={{
                                marginTop: 14,
                                paddingTop: 4,
                                borderTop: '1px solid #ddd',
                                fontSize: 7.5,
                                color: '#777',
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontFamily: 'Arial, sans-serif'
                            }}>
                                <span>Manajemen Aset &amp; E-Office — Yayasan Dar El-Iman Padang</span>
                                <span>Ref: {report.code} | SPK: {spkNumber}</span>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </>
    );
}
