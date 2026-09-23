import React, { useState, useRef } from 'react';
import { Printer, X, ShieldCheck } from 'lucide-react';
import QRCode from 'react-qr-code';

/* ─── Helpers ─── */
const urgencyMap = { NORMAL: 'Biasa / Rutin', URGENT: 'Penting', EMERGENCY: 'Darurat / Mendesak' };
const categoryMap = { ROUTINE: 'Pemeliharaan Rutin (Berkala)', INCIDENT: 'Pemeliharaan Insidentil' };

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

const getSpkNumber = (report) => {
    // Format: SPK-[Bulan-Romawi]/[Tahun]/[Kode]
    if (!report?.createdAt) return `SPK/—/—/${report?.code || '—'}`;
    const d = new Date(report.createdAt);
    return `SPK.${toRoman(d.getMonth() + 1)}/${d.getFullYear()}/${report.code || '—'}`;
};

/* ─── Determine "Pemberi Tugas" from currentUser (who assigned the task) ─── */
const getPemberiTugas = (report, currentUser) => {
    // If we have currentUser context (the admin/kabid who opened this), use it
    if (currentUser && currentUser.name) {
        const role = currentUser.role || '';
        const isStaff = ['ADMIN_ASET', 'BIDANG_IT'].includes(role);
        const isKabid = role === 'KEPALA_BIDANG';
        const isSuperAdmin = role === 'SUPER_ADMIN';

        return {
            name: currentUser.name || currentUser.username || 'Kepala Bidang Sarana',
            position: isStaff
                ? 'Staff Manajemen Aset'
                : isKabid
                ? 'Kepala Bidang Sarana dan Prasarana'
                : isSuperAdmin
                ? 'Kepala Bidang Sarana dan Prasarana'
                : 'Staff Bidang Sarana dan Prasarana',
            org: 'Bidang Sarana dan Prasarana — Yayasan Dar El-Iman Padang',
            nip: currentUser.nip || currentUser.employeeId || '—',
        };
    }

    // Fallback: Kepala Bidang Sarana default
    return {
        name: 'Ravi Kurnia, S.T.',
        position: 'Kepala Bidang Sarana dan Prasarana',
        org: 'Yayasan Dar El-Iman Padang',
        nip: '—',
    };
};

/* ─── Scope of Work derived from report ─── */
const getScopeItems = (report) => {
    const items = [];
    if (report?.description) {
        // Split multiline descriptions into numbered items
        const lines = report.description.split('\n').map(l => l.trim()).filter(Boolean);
        lines.forEach(l => items.push(l));
    }
    if (items.length === 0 && report?.title) items.push(report.title);
    return items;
};

/* ═══════════════════════════════════════════════════════════
   QR TTE Stamp Component
══════════════════════════════════════════════════════════ */
const TTEStamp = ({ pemberiTugas, report }) => {
    const verifyUrl = `https://sarpras.dareliman.or.id/verify/${report?.code || 'SPK'}`;
    const signedAt = report?.approvedAt || report?.assignedAt || report?.updatedAt || new Date().toISOString();

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            padding: '10px 14px',
            background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
            border: '1.5px solid #86efac',
            borderRadius: 10,
            minWidth: 160,
        }}>
            {/* TTE Label */}
            <div style={{
                fontSize: 8, fontWeight: 800, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: '#15803d',
                display: 'flex', alignItems: 'center', gap: 4
            }}>
                <span>✦</span> TTE Elektronik <span>✦</span>
            </div>

            {/* QR Code with centered logo */}
            <div style={{ position: 'relative', display: 'inline-block' }}>
                <QRCode
                    value={verifyUrl}
                    size={72}
                    level="H"
                    style={{ display: 'block' }}
                />
                {/* Centered logo overlay */}
                <div style={{
                    position: 'absolute',
                    top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: '#fff',
                    borderRadius: 4,
                    padding: 2,
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 18, height: 18,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
                }}>
                    <img
                        src="/Sarpras.jpeg"
                        alt="Bidang Sarana"
                        style={{ width: 14, height: 14, objectFit: 'contain', borderRadius: 2 }}
                        onError={(e) => { e.target.src = '/logo_yayasan.jpg'; }}
                    />
                </div>
            </div>

            {/* Signed info */}
            <div style={{ fontSize: 7.5, color: '#166534', textAlign: 'center', lineHeight: 1.4 }}>
                <div style={{ fontWeight: 700 }}>{pemberiTugas.name}</div>
                <div style={{ fontWeight: 500 }}>{formatDateShort(signedAt)}</div>
                <div style={{ fontWeight: 500, color: '#4b5563', fontFamily: 'monospace', fontSize: 7 }}>
                    {(report?.code || 'SPK').substring(0, 16)}
                </div>
            </div>

            {/* Validity badge */}
            <div style={{
                fontSize: 7, fontWeight: 800,
                background: '#15803d', color: '#fff',
                borderRadius: 4, padding: '2px 6px',
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
export default function MaintenanceSPKModal({ show, onClose, report, currentUser }) {
    const printRef = useRef(null);

    // scopeText: bisa diedit oleh pemberi tugas sebelum cetak
    const [scopeText, setScopeText] = useState(() =>
        (report?.description || report?.title || '').trim()
    );

    if (!show || !report) return null;

    const isPembangunan = report.targetDept === 'PEMBANGUNAN';
    const pemberiTugas = getPemberiTugas(report, currentUser);
    const spkNumber = getSpkNumber(report);
    const isAssigned = ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'].includes(report.status);

    // Derive numbered items from the editable text (tiap baris = 1 item)
    const scopeLines = scopeText.split('\n').map(l => l.trim()).filter(Boolean);

    const handlePrint = () => window.print();

    // Determine target date for scope
    const targetDate = report.scheduledDate || report.targetDate || null;

    return (
        <>
            {/* ── Print-specific CSS ── */}
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
                        padding: 16mm 18mm 14mm 18mm !important;
                        font-size: 10.5pt !important;
                        background: white !important;
                        color: black !important;
                        overflow: visible !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .no-print { display: none !important; }
                    .spk-sig-block {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    @page {
                        size: A4 portrait;
                        margin: 0;
                    }
                }
            `}</style>

            {/* ── Backdrop ── */}
            <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-2 sm:p-4"
                onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            >
                <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[96vh] flex flex-col shadow-2xl overflow-hidden">

                    {/* ── Modal Action Bar ── */}
                    <div className="no-print p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Printer size={18} className="text-blue-600" />
                            <h3 className="font-bold text-slate-800 text-sm">Pratinjau Surat Perintah Kerja (SPK)</h3>
                            <span className="text-[10px] font-mono text-slate-400">{spkNumber}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handlePrint}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                            >
                                <Printer size={14} /> Cetak / Ekspor PDF
                            </button>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-slate-200 rounded-xl text-slate-500 transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* ── Printable Document (wrapped for print isolation) ── */}
                    <div id="spk-printable-wrapper">
                    <div
                        id="spk-printable"
                        ref={printRef}
                        style={{
                            padding: '32px 36px',
                            overflowY: 'auto',
                            fontFamily: "'Times New Roman', Times, serif",
                            fontSize: 12,
                            color: '#111',
                            lineHeight: 1.65,
                            background: '#fff',
                            flex: 1,
                        }}
                    >
                        {/* ══ KOP SURAT ══ */}
                        <div style={{ borderBottom: '3px solid #111', paddingBottom: 10, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{ flexShrink: 0 }}>
                                <img
                                    src="/logo_yayasan.jpg"
                                    alt="Logo Yayasan"
                                    style={{ width: 62, height: 62, objectFit: 'contain' }}
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                />
                            </div>
                            <div style={{ flex: 1, textAlign: 'center' }}>
                                <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'Arial, sans-serif' }}>
                                    SISTEM INFORMASI SARPRAS (sarpras.dareliman.or.id)
                                </div>
                                <div style={{ fontSize: 15, fontWeight: 900, fontFamily: 'Arial, sans-serif', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                    YAYASAN DAR EL-IMAN
                                </div>
                                <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'Arial, sans-serif', textTransform: 'uppercase' }}>
                                    {isPembangunan ? 'BIDANG PEMBANGUNAN & PENGEMBANGAN' : 'BIDANG SARANA & PRASARANA'}
                                </div>
                                <div style={{ fontSize: 9.5, color: '#444', fontFamily: 'Arial, sans-serif', marginTop: 1 }}>
                                    Jl. Gunung Juaro RT.02 RW.04, Kel. Surau Gadang, Kec. Nanggalo, Kota Padang — Sumatera Barat
                                </div>
                            </div>
                            <div style={{ flexShrink: 0, width: 62 }} />
                        </div>

                        {/* ══ JUDUL DOKUMEN ══ */}
                        <div style={{ textAlign: 'center', marginBottom: 18 }}>
                            <div style={{
                                fontFamily: 'Arial, sans-serif',
                                fontSize: 14, fontWeight: 900,
                                textTransform: 'uppercase',
                                textDecoration: 'underline',
                                letterSpacing: '0.05em'
                            }}>
                                SURAT PERINTAH KERJA (SPK)
                            </div>
                            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 11, fontWeight: 700, marginTop: 2 }}>
                                Nomor: {spkNumber}
                            </div>
                        </div>

                        {/* ══ PEMBUKA ══ */}
                        <p style={{ marginBottom: 10, textAlign: 'justify', fontSize: 11.5 }}>
                            Berdasarkan laporan permohonan pemeliharaan yang telah diverifikasi melalui sistem{' '}
                            <em>sarpras.dareliman.or.id</em>, Bidang Sarana Dar el-Iman dengan ini memberikan perintah kerja kepada:
                        </p>

                        {/* ══ DATA TEKNISI / PELAKSANA ══ */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12, fontSize: 11.5 }}>
                            <tbody>
                                {[
                                    ['Nama Petugas / Vendor', report.technician || report.technicianName || '[Nama Teknisi Internal / Nama Perusahaan Vendor]'],
                                    ['Status Pelaksana', report.technicianType === 'external' || report.isExternal ? 'Eksternal Yayasan' : 'Internal Yayasan'],
                                    ['Kontak / No. HP', report.technicianPhone || '[Nomor Telepon/HP Pelaksana]'],
                                    ['Alamat (Jika Vendor)', report.technicianAddress || report.contractorAddress || '[Alamat Kantor Vendor / Tempat Usaha]'],
                                ].map(([label, val]) => (
                                    <tr key={label}>
                                        <td style={{ paddingTop: 3, paddingBottom: 3, width: '38%', verticalAlign: 'top', paddingRight: 6 }}>
                                            <strong>{label}</strong>
                                        </td>
                                        <td style={{ paddingTop: 3, paddingBottom: 3, verticalAlign: 'top' }}>
                                            : {val}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* ══ DETAIL PEKERJAAN & LOKASI ══ */}
                        <div style={{ marginBottom: 14 }}>
                            <div style={{
                                fontFamily: 'Arial, sans-serif', fontWeight: 900,
                                fontSize: 11, textTransform: 'uppercase',
                                borderBottom: '1px solid #333', paddingBottom: 3, marginBottom: 8,
                                letterSpacing: '0.05em'
                            }}>
                                Detail Pekerjaan &amp; Lokasi
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, border: '1px solid #999' }}>
                                <thead>
                                    <tr style={{ background: '#1e3a5f', color: '#fff' }}>
                                        <th style={{ padding: '6px 10px', width: '35%', textAlign: 'left', border: '1px solid #999', fontFamily: 'Arial, sans-serif', fontWeight: 700 }}>Parameter</th>
                                        <th style={{ padding: '6px 10px', textAlign: 'left', border: '1px solid #999', fontFamily: 'Arial, sans-serif', fontWeight: 700 }}>Keterangan</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        ['Jenis Pemeliharaan', isPembangunan ? 'Pemeliharaan Bangunan' : 'Pemeliharaan Aset / Pemeliharaan Bangunan'],
                                        ['Kategori / Urgensi', `${categoryMap[report.category] || 'Pemeliharaan Aset'} — ${urgencyMap[report.urgency] || 'Biasa'}`],
                                        ['Unit / Lokasi Kerja', `${report.unit?.name || '[Nama Unit / Gedung / Ruangan Spesifik]'}`],
                                        ['Nama Aset', report.assets && report.assets.length > 0
                                            ? report.assets.map(a => `${a.code} (${a.name})`).join('; ')
                                            : report.location || '[Kode Inventaris / Nama Perangkat / Isi strip perbaikan bangunan]'
                                        ],
                                        ['Tanggal Pengerjaan', targetDate
                                            ? `${formatDate(targetDate)} s.d. [Tanggal Target Selesai]`
                                            : `${formatDate(report.createdAt)} s.d. [Tanggal Target Selesai]`
                                        ],
                                    ].map(([label, val], i) => (
                                        <tr key={label} style={{ background: i % 2 === 0 ? '#f8f9fa' : '#fff' }}>
                                            <td style={{ padding: '5px 10px', border: '1px solid #ccc', fontWeight: 600, verticalAlign: 'top' }}>{label}</td>
                                            <td style={{ padding: '5px 10px', border: '1px solid #ccc', verticalAlign: 'top' }}>{val}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* ══ URAIAN LINGKUP PEKERJAAN ══ */}
                        <div style={{ marginBottom: 14 }}>
                            <div style={{
                                fontFamily: 'Arial, sans-serif', fontWeight: 900,
                                fontSize: 11, textTransform: 'uppercase',
                                borderBottom: '1px solid #333', paddingBottom: 3, marginBottom: 8,
                                letterSpacing: '0.05em',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                            }}>
                                <span>Uraian Lingkup Pekerjaan (Scope of Work)</span>
                            </div>

                            {/* ── Textarea edit (hanya tampil di modal, disembunyikan saat print) ── */}
                            <div className="no-print" style={{
                                marginBottom: 10,
                                background: '#fffbeb',
                                border: '1.5px dashed #f59e0b',
                                borderRadius: 8,
                                padding: '10px 12px',
                            }}>
                                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#92400e', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <span>✏️</span> Edit Uraian (Pemberi Tugas) — tiap baris = 1 poin
                                </div>
                                <textarea
                                    value={scopeText}
                                    onChange={e => setScopeText(e.target.value)}
                                    rows={Math.max(3, scopeLines.length + 1)}
                                    placeholder="Tulis uraian lingkup pekerjaan, pisahkan tiap poin dengan Enter baru..."
                                    style={{
                                        width: '100%',
                                        fontFamily: "'Times New Roman', Times, serif",
                                        fontSize: 12,
                                        lineHeight: 1.6,
                                        border: '1px solid #fcd34d',
                                        borderRadius: 6,
                                        padding: '8px 10px',
                                        background: '#fff',
                                        resize: 'vertical',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                        color: '#111',
                                    }}
                                />
                            </div>

                            {/* ── Rendered numbered list (yang masuk print) ── */}
                            <ol style={{ margin: 0, paddingLeft: 20, fontSize: 11.5 }}>
                                {scopeLines.map((item, i) => (
                                    <li key={i} style={{ marginBottom: 4 }}>{item}</li>
                                ))}
                                {scopeLines.length === 0 && (
                                    <li style={{ color: '#666', fontStyle: 'italic' }}>
                                        [Uraian tindakan perbaikan / pemeliharaan yang harus dilakukan]
                                    </li>
                                )}
                            </ol>
                        </div>

                        {/* ══ KETENTUAN PELAKSANAAN ══ */}
                        <div style={{ marginBottom: 16 }}>
                            <div style={{
                                fontFamily: 'Arial, sans-serif', fontWeight: 900,
                                fontSize: 11, textTransform: 'uppercase',
                                borderBottom: '1px solid #333', paddingBottom: 3, marginBottom: 8,
                                letterSpacing: '0.05em'
                            }}>
                                Ketentuan Pelaksanaan
                            </div>
                            <ol style={{ margin: 0, paddingLeft: 20, fontSize: 11, lineHeight: 1.7 }}>
                                <li>
                                    <strong>Standar Kualitas &amp; Batasan:</strong> Pekerjaan pemeliharaan bangunan ringan dilarang keras melakukan perubahan yang merusak struktur utama bangunan.
                                </li>
                                <li>
                                    <strong>Pembaruan Progres:</strong> Petugas/Vendor wajib mengunggah status dan dokumentasi progres pekerjaan secara berkala melalui sistem{' '}
                                    <em>sarpras.dareliman.or.id</em>.
                                </li>
                                <li>
                                    <strong>Penyelesaian &amp; Serah Terima:</strong> Setelah pekerjaan selesai, pelaksana wajib melakukan uji coba bersama pihak pemohon dan menandatangani Berita Acara Serah Terima (BAST).
                                </li>
                                <li>
                                    <strong>Biaya &amp; Material:</strong> Segala bentuk penggantian suatu cadang atau biaya tambahan wajib dikonfirmasikan dan disetujui oleh Bidang Sarana sebelum dipasang/digunakan.
                                </li>
                            </ol>
                        </div>

                        {/* ══ ASET TERKAIT (jika ada) ══ */}
                        {report.assets && report.assets.length > 0 && (
                            <div style={{ marginBottom: 16 }}>
                                <div style={{
                                    fontFamily: 'Arial, sans-serif', fontWeight: 900,
                                    fontSize: 11, textTransform: 'uppercase',
                                    borderBottom: '1px solid #333', paddingBottom: 3, marginBottom: 8,
                                    letterSpacing: '0.05em'
                                }}>
                                    Daftar Aset yang Dipelihara
                                </div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5, border: '1px solid #ccc' }}>
                                    <thead>
                                        <tr style={{ background: '#1e3a5f', color: '#fff' }}>
                                            <th style={{ padding: '5px 8px', border: '1px solid #999', fontFamily: 'Arial, sans-serif', width: 30 }}>No</th>
                                            <th style={{ padding: '5px 8px', border: '1px solid #999', fontFamily: 'Arial, sans-serif' }}>Kode Aset</th>
                                            <th style={{ padding: '5px 8px', border: '1px solid #999', fontFamily: 'Arial, sans-serif' }}>Nama Aset / Barang</th>
                                            <th style={{ padding: '5px 8px', border: '1px solid #999', fontFamily: 'Arial, sans-serif' }}>Kondisi Awal</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {report.assets.map((a, i) => (
                                            <tr key={a.id} style={{ background: i % 2 === 0 ? '#f8f9fa' : '#fff' }}>
                                                <td style={{ padding: '4px 8px', border: '1px solid #ccc', textAlign: 'center' }}>{i + 1}</td>
                                                <td style={{ padding: '4px 8px', border: '1px solid #ccc', fontFamily: 'monospace', fontWeight: 700, color: '#1d4ed8' }}>{a.code}</td>
                                                <td style={{ padding: '4px 8px', border: '1px solid #ccc' }}>{a.name}</td>
                                                <td style={{ padding: '4px 8px', border: '1px solid #ccc' }}>{a.condition || 'BAIK'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* ══ PENUTUP ══ */}
                        <p style={{ marginBottom: 20, fontSize: 11.5, textAlign: 'justify' }}>
                            Demikian Surat Perintah Kerja ini diterbitkan untuk dilaksanakan dengan penuh tanggung jawab.
                            Apabila pekerjaan telah selesai dilaksanakan, harap segera melaporkan hasil pekerjaan melalui
                            sistem sarpras.dareliman.or.id dan menandatangani Berita Acara Serah Terima (BAST).
                        </p>

                        {/* ══ TANDA TANGAN PEMBERI TUGAS ══ */}
                        <div
                            className="spk-sig-block"
                            style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, pageBreakInside: 'avoid', breakInside: 'avoid' }}
                        >
                            <div style={{
                                textAlign: 'center',
                                minWidth: 220,
                                fontSize: 11.5,
                                fontFamily: "'Times New Roman', Times, serif"
                            }}>
                                {/* Place & Date */}
                                <div style={{ marginBottom: 4 }}>
                                    Padang, {formatDate(report.approvedAt || report.assignedAt || report.updatedAt || new Date())}
                                </div>
                                <div style={{ marginBottom: 10 }}>
                                    <strong>Pemberi Tugas,</strong>
                                </div>

                                {/* TTE Block + keterangan — dijaga tidak terpisah halaman */}
                                <div style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                                    {isAssigned ? (
                                        <>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                                <TTEStamp pemberiTugas={pemberiTugas} report={report} />
                                            </div>
                                            {/* 1 baris keterangan — ikut TTE ke halaman berikutnya */}
                                            <div style={{
                                                marginTop: 4, fontSize: 8, color: '#15803d',
                                                border: '1px solid #bbf7d0', borderRadius: 4,
                                                padding: '2px 6px', background: '#f0fdf4',
                                                display: 'inline-flex', alignItems: 'center', gap: 3
                                            }}>
                                                <span>✓</span> Ditandatangani secara elektronik melalui sarpras.dareliman.or.id
                                            </div>
                                        </>
                                    ) : (
                                        <div style={{
                                            width: 140, height: 70, margin: '0 auto 8px',
                                            border: '1px dashed #ccc', borderRadius: 6,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: '#ccc', fontSize: 9, fontStyle: 'italic'
                                        }}>
                                            Tanda Tangan
                                        </div>
                                    )}
                                </div>

                                {/* Name & Position */}
                                <div style={{ borderTop: '1px solid #111', paddingTop: 4, marginTop: 8 }}>
                                    <div style={{ fontWeight: 900, fontSize: 12 }}>
                                        <strong><u>{pemberiTugas.name}</u></strong>
                                    </div>
                                    <div style={{ fontSize: 10.5, color: '#444' }}>
                                        {pemberiTugas.position}
                                    </div>
                                    <div style={{ fontSize: 10, color: '#666' }}>
                                        {pemberiTugas.org}
                                    </div>
                                    {pemberiTugas.nip && pemberiTugas.nip !== '—' && (
                                        <div style={{ fontSize: 9.5, color: '#555', fontFamily: 'monospace', marginTop: 1 }}>
                                            NIP: {pemberiTugas.nip}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ══ FOOTER ══ */}
                        <div style={{
                            marginTop: 24, paddingTop: 8,
                            borderTop: '1px solid #ddd',
                            fontSize: 8.5, color: '#888',
                            display: 'flex', justifyContent: 'space-between',
                            fontFamily: 'Arial, sans-serif'
                        }}>
                            <span>Dicetak melalui Sistem Informasi Sarpras — sarpras.dareliman.or.id</span>
                            <span>Nomor Laporan: {report.code} | {formatDate(new Date())}</span>
                        </div>
                    </div>
                    </div> {/* end spk-printable-wrapper */}
                    {/* ── end printable ── */}

                </div>
            </div>
        </>
    );
}
