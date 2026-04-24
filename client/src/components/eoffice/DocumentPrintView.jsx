import React, { forwardRef } from 'react';
import QRCode from 'react-qr-code';

const DocumentPrintView = forwardRef(({ doc, settings }, ref) => {
    if (!doc) return null;
    const orgName = settings?.orgName || 'Yayasan Dar El-Iman';
    const orgAddress = settings?.orgAddress || 'Jl. Gajah Mada No. 123, Padang, Sumatera Barat';
    const orgPhone = settings?.orgPhone || '';
    const orgEmail = settings?.orgEmail || '';
    const orgLogo = settings?.orgLogo || null;
    const dateStr = new Date(doc.updatedAt || doc.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const typeLabels = { NOTA_DINAS: 'NOTA DINAS', SURAT_TUGAS: 'SURAT TUGAS', SURAT_KEPUTUSAN: 'SURAT KEPUTUSAN', SURAT_EDARAN: 'SURAT EDARAN', BAST: 'BERITA ACARA SERAH TERIMA' };

    return (
        <div ref={ref} className="bg-white text-black" style={{ width: '210mm', minHeight: '297mm', padding: '15mm 20mm', fontFamily: "'Times New Roman', serif", fontSize: '12pt', lineHeight: '1.6' }}>
            {/* KOP SURAT */}
            <div style={{ display: 'flex', alignItems: 'center', borderBottom: '3px solid #000', paddingBottom: '10px', marginBottom: '5px' }}>
                <div style={{ width: '80px', flexShrink: 0, marginRight: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {orgLogo ? (
                        <img src={orgLogo} alt="Logo" style={{ width: '70px', height: '70px', objectFit: 'contain' }} />
                    ) : (
                        <div style={{ width: '65px', height: '65px', border: '2px solid #999', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: '#999', fontFamily: 'sans-serif' }}>LOGO</div>
                    )}
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                    <h1 style={{ fontSize: '18pt', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '2px', margin: 0 }}>{orgName}</h1>
                    <h2 style={{ fontSize: '13pt', fontWeight: 'bold', margin: '2px 0' }}>Divisi Sarana dan Prasarana</h2>
                    <p style={{ fontSize: '9pt', margin: 0, color: '#444' }}>{orgAddress}</p>
                    {(orgPhone || orgEmail) && <p style={{ fontSize: '9pt', margin: 0, color: '#444' }}>Telp: {orgPhone} | Email: {orgEmail}</p>}
                </div>
                <div style={{ width: '80px', flexShrink: 0 }}></div>
            </div>
            <div style={{ borderBottom: '1px solid #000', marginBottom: '20px' }}></div>

            {/* JUDUL SURAT */}
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <p style={{ fontWeight: 'bold', textDecoration: 'underline', fontSize: '13pt', textTransform: 'uppercase', margin: '0 0 4px 0' }}>
                    {typeLabels[doc.type] || doc.type.replace(/_/g, ' ')}
                </p>
                <p style={{ fontSize: '10pt', margin: 0 }}>Nomor: {doc.code}</p>
            </div>

            {/* PERIHAL & TUJUAN */}
            <div style={{ marginBottom: '16px' }}>
                <table style={{ fontSize: '12pt' }}>
                    <tbody>
                        {doc.destination && (
                            <>
                                <tr><td style={{ verticalAlign: 'top', paddingRight: '8px' }}>Kepada Yth.</td><td>:</td><td style={{ paddingLeft: '8px', fontWeight: 'bold' }}>{doc.destination}</td></tr>
                                <tr><td></td><td></td><td style={{ paddingLeft: '8px' }}>di Tempat</td></tr>
                            </>
                        )}
                    </tbody>
                </table>
            </div>

            {doc.type !== 'SURAT_KEPUTUSAN' && doc.type !== 'BAST' && (
                <div style={{ marginBottom: '16px' }}>
                    <table style={{ fontSize: '12pt' }}>
                        <tbody>
                            <tr><td style={{ paddingRight: '8px' }}>Perihal</td><td>:</td><td style={{ paddingLeft: '8px', fontWeight: 'bold' }}>{doc.title}</td></tr>
                        </tbody>
                    </table>
                </div>
            )}

            {/* ISI SURAT */}
            <div style={{ textAlign: 'justify', whiteSpace: 'pre-wrap', minHeight: '300px', marginTop: '10px' }}>
                {doc.content}
            </div>

            {/* TANDA TANGAN */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '40px' }}>
                <div style={{ width: '250px', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 4px 0' }}>Padang, {dateStr}</p>
                    <p style={{ margin: '0 0 8px 0' }}>Dikeluarkan oleh,</p>

                    {/* QR Code & Signature Area */}
                    <div style={{ minHeight: '120px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 0' }}>
                        {doc.status === 'SIGNED' && doc.hash && (
                            <QRCode value={`${window.location.origin}/validate/${doc.hash}`} size={80} level="H" />
                        )}

                        {/* Show approver signatures */}
                        {doc.approvals && doc.approvals.filter(a => a.status === 'APPROVED' && a.signature && a.signature.startsWith('data:image')).map((a, i) => (
                            <img key={i} src={a.signature} alt="TTE" style={{ maxWidth: '150px', maxHeight: '60px', objectFit: 'contain', marginTop: '4px' }} />
                        ))}

                        {doc.status === 'SIGNED' && (
                            <p style={{ fontSize: '7pt', fontStyle: 'italic', color: '#888', margin: '4px 0 0 0', fontFamily: 'sans-serif' }}>
                                Ditandatangani secara elektronik
                            </p>
                        )}
                    </div>

                    <p style={{ fontWeight: 'bold', textDecoration: 'underline', margin: '4px 0 2px 0' }}>{doc.senderName || doc.creator?.name || 'Kepala Sarpras'}</p>
                    <p style={{ fontSize: '10pt', margin: 0 }}>{doc.creator?.position || 'Divisi Sarana & Prasarana'}</p>
                    {doc.creator?.nip && <p style={{ fontSize: '9pt', margin: 0 }}>NIP. {doc.creator.nip}</p>}
                </div>
            </div>

            {/* APPROVAL TRAIL for multi-signer */}
            {doc.approvals && doc.approvals.length > 1 && (
                <div style={{ marginTop: '40px', borderTop: '1px solid #ddd', paddingTop: '16px' }}>
                    <p style={{ fontSize: '9pt', fontFamily: 'sans-serif', fontWeight: 'bold', color: '#666', marginBottom: '8px' }}>Jejak Persetujuan:</p>
                    <div style={{ display: 'flex', gap: '40px', justifyContent: 'center' }}>
                        {doc.approvals.map((a, i) => (
                            <div key={i} style={{ textAlign: 'center', minWidth: '150px' }}>
                                <p style={{ fontSize: '8pt', fontFamily: 'sans-serif', color: '#888', margin: '0 0 4px 0' }}>
                                    {a.type === 'SIGNATURE' ? 'Penandatangan' : `Pemaraf ${i + 1}`}
                                </p>
                                <div style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {a.status === 'APPROVED' && a.signature && a.signature.startsWith('data:image') ? (
                                        <img src={a.signature} alt="TTE" style={{ maxWidth: '120px', maxHeight: '50px', objectFit: 'contain' }} />
                                    ) : a.status === 'APPROVED' ? (
                                        <span style={{ fontSize: '8pt', color: '#16a34a', fontFamily: 'sans-serif' }}>✓ Disetujui</span>
                                    ) : (
                                        <span style={{ fontSize: '8pt', color: '#999', fontFamily: 'sans-serif' }}>Menunggu</span>
                                    )}
                                </div>
                                <p style={{ fontSize: '9pt', fontWeight: 'bold', textDecoration: 'underline', margin: '4px 0 0 0' }}>{a.user?.name || '-'}</p>
                                <p style={{ fontSize: '8pt', margin: 0 }}>{a.user?.position || '-'}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
});

DocumentPrintView.displayName = 'DocumentPrintView';
export default DocumentPrintView;
