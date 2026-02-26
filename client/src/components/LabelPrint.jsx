import React from 'react';
import QRCode from 'react-qr-code';

export const LabelPrint = React.forwardRef(({ asset, size = 'small', institute }, ref) => {
    const config = size === 'mini'
        ? {
            width: '3cm', height: '4cm',
            qr: 65, logo: '16px',
            title: '8px', room: '7px', code: '9px',
            padding: '8px'
        }
        : size === 'small'
            ? {
                width: '4cm', height: '5.5cm',
                qr: 90, logo: '22px',
                title: '10px', room: '10px', code: '12px',
                padding: '12px'
            }
            : {
                width: '5.5cm', height: '7cm',
                qr: 125, logo: '30px',
                title: '14px', room: '14px', code: '16px',
                padding: '20px'
            };

    const containerStyle = {
        width: config.width,
        height: config.height,
        backgroundColor: '#fff',
        padding: config.padding
    };

    const orgName = institute?.orgName || "YAYASAN DAR EL IMAN";
    const orgLogo = institute?.orgLogo;

    return (
        <div ref={ref} className="p-2 inline-block print:p-0">
            <style>{`
                @media print {
                    .single-label-container {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .room-text-bold {
                        color: #000000 !important;
                        font-weight: 800 !important;
                        -webkit-print-color-adjust: exact;
                    }
                }
            `}</style>
            <div style={containerStyle} className="single-label-container flex flex-col items-center justify-center rounded-sm border border-slate-200 shadow-sm transition-all text-center overflow-hidden">
                {/* Institute Title */}
                <h2 className="font-bold uppercase text-slate-800 mb-2 leading-tight" style={{ fontSize: config.title }}>
                    {orgName}
                </h2>

                {/* QR Code Container with Center Logo */}
                <div className="relative bg-white p-1 rounded-sm shadow-sm border border-slate-100 flex items-center justify-center mb-3">
                    <QRCode
                        value={`${window.location.origin}/public/asset/${asset?.id}`}
                        size={config.qr}
                        level="H"
                    />
                    {orgLogo && (
                        <div
                            className="absolute bg-white p-[2px] rounded-sm"
                            style={{
                                width: config.logo,
                                height: config.logo
                            }}
                        >
                            <img
                                src={orgLogo}
                                alt="logo"
                                className="w-full h-full object-contain"
                            />
                        </div>
                    )}
                </div>

                {/* Room and Asset Code below QR */}
                <div className="flex flex-col items-center justify-center gap-1.5 w-full">
                    <p className="room-text-bold uppercase tracking-tight truncate w-full italic px-1 text-black font-[800]" style={{ fontSize: config.room }}>
                        {asset?.room?.name || 'TANPA RUANGAN'}
                    </p>
                    <div className="bg-slate-50 px-3 py-1 rounded-sm border border-slate-300">
                        <p className="font-mono text-black font-extrabold tracking-wider leading-none" style={{ fontSize: config.code }}>
                            {asset?.code || '-'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
});

export const BatchLabelPrint = React.forwardRef(({ assets, institute, layout = '2x4' }, ref) => {
    const orgName = institute?.orgName || "YAYASAN DAR EL IMAN";
    const orgLogo = institute?.orgLogo;

    // Layout configuration (Adjusted for square labels with room visibility)
    const getLayoutConfigs = (id) => {
        switch (id) {
            case '2x2': return { cols: 2, width: '90mm', height: '125mm', qr: 200, logoSize: '45px', title: '20pt', room: '16pt', code: '18pt', padding: '12mm' };
            case '3x4': return { cols: 3, width: '60mm', height: '70mm', qr: 130, logoSize: '32px', title: '12pt', room: '10pt', code: '12pt', padding: '6mm' };
            case '3x7': return { cols: 3, width: '60mm', height: '42mm', qr: 80, logoSize: '20px', title: '10pt', room: '8pt', code: '10pt', padding: '4mm' };
            case '3x10': return { cols: 3, width: '60mm', height: '29mm', qr: 55, logoSize: '14px', title: '8pt', room: '7pt', code: '9pt', padding: '2.5mm' };
            case '4x14': return { cols: 4, width: '48mm', height: '20mm', qr: 42, logoSize: '10px', title: '6pt', room: '5.5pt', code: '7.5pt', padding: '1.5mm' };
            case '2x4':
            default: return { cols: 2, width: '90mm', height: '70mm', qr: 160, logoSize: '40px', title: '16pt', room: '12pt', code: '16pt', padding: '8mm' };
        }
    };


    const config = getLayoutConfigs(layout);

    return (
        <div ref={ref} className="print-container">
            <style>{`
                @media print {
                    @page {
                        size: A4;
                        margin: 10mm;
                    }
                    .print-container {
                        width: 100%;
                        display: grid;
                        grid-template-columns: repeat(${config.cols}, 1fr);
                        gap: 2mm;
                        row-gap: 5mm;
                        page-break-inside: avoid;
                    }
                    .label-item {
                        width: ${config.width};
                        height: ${config.height};
                        page-break-inside: avoid;
                        background-color: #fff !important;
                        padding: ${config.padding};
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        border: 0.2mm solid #eee;
                        border-radius: 2px;
                        -webkit-print-color-adjust: exact;
                    }
                    .batch-org-title { font-size: ${config.title}; }
                    .batch-room-text { 
                        font-size: ${config.room}; 
                        font-weight: 800; 
                        color: #000000 !important; 
                        margin-bottom: 2mm;
                        text-transform: uppercase;
                        font-style: italic;
                        -webkit-print-color-adjust: exact;
                    }
                    .batch-code-text { font-size: ${config.code}; }
                    .batch-qr-container { margin-bottom: 2mm; position: relative; display: flex; align-items: center; justify-content: center; }
                }
                
                .print-container {
                    padding: 20px;
                    display: grid;
                    grid-template-columns: repeat(${config.cols}, 1fr);
                    gap: 16px;
                    max-width: 210mm;
                    margin: 0 auto;
                }
                .label-item {
                    width: 100%;
                    height: ${config.height};
                    border: 1px solid #e2e8f0;
                    padding: ${config.padding};
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    background: white;
                    border-radius: 8px;
                }
                .batch-org-title {
                    font-weight: 800;
                    color: #1e293b;
                    text-transform: uppercase;
                    margin-bottom: 2mm;
                    width: 100%;
                    text-align: center;
                    font-size: ${config.title};
                }
                .batch-qr-container {
                    position: relative;
                    margin-bottom: 3mm;
                    background: white;
                    padding: 2px;
                    border: 1px solid #f1f5f9;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .batch-logo-embed {
                    position: absolute;
                    background: white;
                    padding: 2px;
                    border-radius: 1px;
                }
                .batch-room-text {
                    font-weight: 800;
                    color: #000000;
                    text-transform: uppercase;
                    margin-bottom: 2mm;
                    text-align: center;
                    width: 100%;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    font-style: italic;
                }
                .batch-code-box {
                    background: #f8fafc;
                    padding: 1mm 4mm;
                    border-radius: 1mm;
                    border: 0.5px solid #cbd5e1;
                }
                .batch-code-text {
                    font-family: 'Courier New', monospace;
                    font-weight: 800;
                    color: #000;
                    font-size: ${config.code};
                }
            `}</style>
            {assets.map(asset => (
                <div key={asset.id} className="label-item">
                    {/* Top: Org Name */}
                    <h2 className="batch-org-title">{orgName}</h2>

                    {/* Middle: QR with Logo */}
                    <div className="batch-qr-container">
                        <QRCode
                            value={`${window.location.origin}/public/asset/${asset?.id}`}
                            size={config.qr}
                            level="H"
                        />
                        {orgLogo && (
                            <div className="batch-logo-embed" style={{ width: config.logoSize, height: config.logoSize }}>
                                <img src={orgLogo} alt="Logo" className="w-full h-full object-contain" />
                            </div>
                        )}
                    </div>

                    {/* Bottom: Room and Asset Code */}
                    <div className="batch-room-text">{asset?.room?.name || 'Tanpa Ruangan'}</div>
                    <div className="batch-code-box">
                        <span className="batch-code-text">{asset?.code || '-'}</span>
                    </div>
                </div>
            ))}
        </div>
    );
});
