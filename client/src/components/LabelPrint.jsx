import React from 'react';
import QRCode from 'react-qr-code';

export const LabelPrint = React.forwardRef(({ asset, size = 'small', institute }, ref) => {
    const containerStyle = size === 'small'
        ? { width: '4cm', height: '5cm', backgroundColor: '#fff' }
        : { width: '5.5cm', height: '6.5cm', backgroundColor: '#fff' };

    const orgName = institute?.orgName || "YAYASAN DAR EL IMAN";
    const orgLogo = institute?.orgLogo;

    return (
        <div ref={ref} className="p-2 inline-block print:p-0">
            <div style={containerStyle} className="flex flex-col items-center justify-center p-3 rounded-sm border border-slate-200 shadow-sm transition-all text-center">
                {/* Institute Title */}
                <h2 className="font-bold text-[10px] uppercase text-slate-800 mb-2 leading-tight">
                    {orgName}
                </h2>

                {/* QR Code Container with Center Logo */}
                <div className="relative bg-white p-1 rounded-sm shadow-sm border border-slate-100 flex items-center justify-center mb-3">
                    <QRCode
                        value={JSON.stringify({
                            code: asset?.code || '-',
                            id: asset?.id,
                        })}
                        size={size === 'small' ? 100 : 140}
                        level="H"
                    />
                    {orgLogo && (
                        <div
                            className="absolute bg-white p-[2px] rounded-sm"
                            style={{
                                width: size === 'small' ? '24px' : '34px',
                                height: size === 'small' ? '24px' : '34px'
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
                <div className="flex flex-col items-center justify-center gap-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight truncate max-w-full italic px-2">
                        {asset?.room?.name || 'TANPA RUANGAN'}
                    </p>
                    <div className="bg-slate-50 px-3 py-1 rounded-sm border border-slate-300">
                        <p className="font-mono text-[12px] text-black font-extrabold tracking-wider leading-none">
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

    // Layout configuration (Adjusted for square labels)
    const getLayoutConfigs = (id) => {
        switch (id) {
            case '2x2': return { cols: 2, width: '90mm', height: '120mm', qr: 200, logoSize: '45px', title: '18pt', room: '14pt', code: '16pt', padding: '10mm' };
            case '3x4': return { cols: 3, width: '60mm', height: '65mm', qr: 130, logoSize: '30px', title: '11pt', room: '9pt', code: '11pt', padding: '5mm' };
            case '3x7': return { cols: 3, width: '60mm', height: '38mm', qr: 80, logoSize: '18px', title: '8pt', room: '7pt', code: '9pt', padding: '3mm' };
            case '3x10': return { cols: 3, width: '60mm', height: '26mm', qr: 55, logoSize: '14px', title: '7pt', room: '6pt', code: '8pt', padding: '2mm' };
            case '2x4':
            default: return { cols: 2, width: '90mm', height: '65mm', qr: 160, logoSize: '40px', title: '14pt', room: '11pt', code: '14pt', padding: '6mm' };
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
                    }
                    .batch-org-title { font-size: ${config.title}; }
                    .batch-room-text { 
                        font-size: ${config.room}; 
                        font-weight: 700; 
                        color: #64748b; 
                        margin-bottom: 1.5mm;
                        text-transform: uppercase;
                        font-style: italic;
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
                    background-color: #fff;
                    padding: ${config.padding};
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    border: 1px solid #eee;
                    border-radius: 4px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                }
                .batch-org-title {
                    font-weight: bold;
                    color: #1e293b;
                    text-transform: uppercase;
                    margin-bottom: 2mm;
                    line-height: 1.1;
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
                    font-weight: 700;
                    color: #64748b;
                    text-transform: uppercase;
                    margin-bottom: 1.5mm;
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
                            value={JSON.stringify({
                                code: asset?.code || '-',
                                id: asset?.id,
                            })}
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
