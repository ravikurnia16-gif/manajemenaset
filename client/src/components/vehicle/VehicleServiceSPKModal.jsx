import React, { useRef } from 'react';
import { Printer, X, ShieldCheck } from 'lucide-react';
import QRCode from 'react-qr-code';

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

/* ─── QR TTE Stamp Component (Compact Single Page) ─── */
const VehicleTTEStamp = ({ spk, service }) => {
    const docUuid = spk?.uuid || service?.spkUuid || service?.code || 'SPK';
    const verifyUrl = `https://sarpras.dareliman.or.id/verify/${docUuid}`;
    const signedAt = spk?.signedAt || service?.approvedAt || new Date().toISOString();
    const signerName = spk?.signedBy || service?.approvedBy?.name || 'Ravi Kurnia, S.T.';

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
            <div style={{
                fontSize: 7.5, fontWeight: 800, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: '#15803d',
                display: 'flex', alignItems: 'center', gap: 3
            }}>
                <span>✦</span> TTE ELEKTRONIK <span>✦</span>
            </div>

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

            <div style={{ fontSize: 7, color: '#166534', textAlign: 'center', lineHeight: 1.3 }}>
                <div style={{ fontWeight: 700 }}>{signerName}</div>
                <div style={{ fontWeight: 500 }}>{formatDateShort(signedAt)}</div>
                <div style={{ fontWeight: 500, color: '#4b5563', fontFamily: 'monospace', fontSize: 6.5 }}>
                    {spk?.number || service?.spkNumber || service?.code || 'SPK'}
                </div>
            </div>

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

export default function VehicleServiceSPKModal({ show, onClose, service }) {
    const printRef = useRef(null);

    if (!show || !service) return null;

    const spkNumber = service.spkNumber || '—/SPK/SRN/—/—';
    const isSigned = !!(service.approvedAt || service.status === 'APPROVED' || service.status === 'IN_PROGRESS' || service.status === 'COMPLETED');
    const signerName = service.approvedBy?.name || 'Ravi Kurnia, S.T.';
    const signerPosition = service.approvedBy?.position || 'Kepala Bidang Sarana';

    const items = Array.isArray(service.items) ? service.items : [];

    const handlePrint = () => {
        window.print();
    };

    return (
        <>
            {/* ── Strict A4 Single-Page Print Stylesheet ── */}
            <style>{`
                @media print {
                    body > * { display: none !important; }
                    #vehicle-spk-printable-wrapper { display: block !important; }
                    #vehicle-spk-printable-wrapper * { visibility: visible !important; }
                    #vehicle-spk-printable-wrapper {
                        position: fixed !important;
                        inset: 0 !important;
                        width: 100% !important;
                        height: auto !important;
                        overflow: visible !important;
                        background: white !important;
                        z-index: 99999 !important;
                    }
                    #vehicle-spk-printable {
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

            <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4"
                onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            >
                <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[96vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
                    {/* Header Action Bar */}
                    <div className="no-print p-4 border-b border-slate-200 bg-slate-900 text-white flex justify-between items-center">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-blue-600/30 border border-blue-500/40 rounded-xl text-blue-400">
                                <Printer size={18} />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm">SPK Servis Kendaraan Resmi (E-Office)</h3>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[11px] font-mono text-blue-300 font-semibold">{spkNumber}</span>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                        <ShieldCheck size={11} /> TTE Kepala Bidang Sarana
                                    </span>
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

                    {/* Printable Sheet */}
                    <div id="vehicle-spk-printable-wrapper" className="flex-1 overflow-y-auto">
                        <div
                            id="vehicle-spk-printable"
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
                            {/* ══ KOP SURAT (Tanpa Sistem Informasi, Tanpa Prasarana) ══ */}
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
                                        BIDANG SARANA
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

                            {/* ══ JUDUL & NOMOR SURAT ══ */}
                            <div style={{ textAlign: 'center', marginBottom: 12 }}>
                                <div style={{
                                    fontFamily: 'Arial, sans-serif',
                                    fontSize: 13,
                                    fontWeight: 900,
                                    textTransform: 'uppercase',
                                    textDecoration: 'underline',
                                    letterSpacing: '0.04em'
                                }}>
                                    SURAT PERINTAH KERJA (SPK) PEMELIHARAAN KENDARAAN
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
                                Berdasarkan pengajuan pemeliharaan kendaraan operasional yang telah diverifikasi dan disetujui, Bidang Sarana Yayasan Dar el-Iman dengan ini memberikan perintah pelaksanaan servis/perbaikan kepada:
                            </p>

                            {/* ══ DATA BENGKEL & PELAKSANA ══ */}
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10, fontSize: 10.5 }}>
                                <tbody>
                                    {[
                                        ['Nama Bengkel Ditunjuk', service.workshop || 'Bengkel Rekanan Resmi Yayasan'],
                                        ['Petugas Pengaju / Supir', service.requester?.name || service.requester?.username || 'Staff Kendaraan'],
                                        ['Kontak / No. HP Petugas', service.requester?.phone || '-'],
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

                            {/* ══ DETAIL ARMADA KENDARAAN & SPESIFIKASI ══ */}
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
                                    Spesifikasi Armada Kendaraan
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
                                            ['Nama / Merk Kendaraan', `${service.vehicle?.name || '-'} (${service.vehicle?.brand || '-'})`],
                                            ['Nomor Polisi (Plat)', service.vehicle?.plateNumber || '-'],
                                            ['Tipe / Jenis Kendaraan', service.vehicle?.type || 'Kendaraan Operasional'],
                                            ['KM Odometer Terakhir', service.odometer ? `${service.odometer.toLocaleString()} km` : '-'],
                                            ['Kategori / Tipe Pengerjaan', `${service.category === 'ROUTINE' ? 'Pemeliharaan Rutin' : 'Insidentil'} — ${service.type}`],
                                            ['Target Waktu Selesai', service.targetDate ? formatDate(service.targetDate) : 'Selesai pengerjaan bengkel'],
                                        ].map(([label, val], i) => (
                                            <tr key={label} style={{ background: i % 2 === 0 ? '#f8f9fa' : '#fff' }}>
                                                <td style={{ padding: '3px 8px', border: '1px solid #ccc', fontWeight: 600, verticalAlign: 'top' }}>{label}</td>
                                                <td style={{ padding: '3px 8px', border: '1px solid #ccc', verticalAlign: 'top' }}>{val}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* ══ URAIAN PEKERJAAN & KOMPONEN ══ */}
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
                                    Lingkup Pengerjaan &amp; Komponen Servis
                                </div>
                                <div style={{ fontSize: 10, marginBottom: 4 }}>
                                    <strong>Keluhan / Instruksi:</strong> {service.description}
                                </div>
                                {service.approvalNote && (
                                    <div style={{ fontSize: 10, marginBottom: 4, color: '#166534', background: '#f0fdf4', padding: '4px 8px', borderRadius: 4, border: '1px solid #bbf7d0' }}>
                                        <strong>Catatan Khusus Kabid Sarana:</strong> {service.approvalNote}
                                    </div>
                                )}
                                {items.length > 0 && (
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9, border: '1px solid #ccc', marginTop: 4 }}>
                                        <thead>
                                            <tr style={{ background: '#f1f5f9' }}>
                                                <th style={{ padding: '3px 6px', border: '1px solid #ccc', width: 25, textAlign: 'center' }}>No</th>
                                                <th style={{ padding: '3px 6px', border: '1px solid #ccc', textAlign: 'left' }}>Item / Komponen yang Diperbaiki atau Diganti</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {items.map((it, idx) => (
                                                <tr key={idx}>
                                                    <td style={{ padding: '2px 6px', border: '1px solid #ccc', textAlign: 'center' }}>{idx + 1}</td>
                                                    <td style={{ padding: '2px 6px', border: '1px solid #ccc' }}>{it.name || it}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            {/* ══ KETENTUAN PELAKSANAAN BENGKEL ══ */}
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
                                        <strong>Kualitas Sparepart:</strong> Penggantian suku cadang wajib menggunakan suku cadang asli (original) atau setara standar pabrikan.
                                    </li>
                                    <li style={{ marginBottom: 2 }}>
                                        <strong>Persetujuan Biaya Tambahan:</strong> Jika ditemukan kerusakan tambahan di luar SPK ini, wajib dikonfirmasikan dan disetujui terlebih dahulu oleh Bidang Sarana.
                                    </li>
                                    <li style={{ marginBottom: 2 }}>
                                        <strong>Faktur &amp; Bekas Sparepart:</strong> Pihak bengkel wajib menerbitkan kuitansi/faktur resmi berstempel dan menyerahkan suku cadang lama yang diganti.
                                    </li>
                                </ol>
                            </div>

                            {/* ══ PENUTUP & TANDA TANGAN ANTI-BREAK ══ */}
                            <div className="spk-keep-together" style={{ pageBreakInside: 'avoid', breakInside: 'avoid', marginTop: 6 }}>
                                <p style={{ marginBottom: 12, fontSize: 10, textAlign: 'justify', lineHeight: 1.4 }}>
                                    Demikian Surat Perintah Kerja ini diterbitkan untuk dipergunakan sebagaimana mestinya dalam pelaksanaan servis armada Yayasan Dar El-Iman.
                                </p>

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
                                        <div style={{ marginBottom: 2 }}>
                                            Padang, {formatDate(service.approvedAt || service.date || new Date())}
                                        </div>
                                        <div style={{ marginBottom: 6, fontWeight: 700 }}>
                                            Pemberi Perintah,
                                        </div>

                                        <div style={{ minHeight: 76, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                            {isSigned ? (
                                                <>
                                                    <VehicleTTEStamp service={service} spk={{
                                                        uuid: service.spkUuid,
                                                        number: spkNumber,
                                                        signedAt: service.approvedAt,
                                                        signedBy: signerName
                                                    }} />
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

                                        <div style={{ borderTop: '1px solid #222', paddingTop: 3, marginTop: 6 }}>
                                            <div style={{ fontWeight: 800, fontSize: 11 }}>
                                                <strong><u>{signerName}</u></strong>
                                            </div>
                                            <div style={{ fontSize: 9.5, color: '#333' }}>
                                                {signerPosition}
                                            </div>
                                            <div style={{ fontSize: 8.5, color: '#555' }}>
                                                Bidang Sarana — Yayasan Dar El-Iman Padang
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ══ FOOTER ══ */}
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
                                <span>Manajemen Armada &amp; E-Office — Yayasan Dar El-Iman Padang</span>
                                <span>Kode: {service.code || `PK-${service.id}`} | SPK: {spkNumber}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
