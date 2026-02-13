import React from 'react';
import QRCode from 'react-qr-code';

export const LabelPrint = React.forwardRef(({ asset, size = 'small', institute }, ref) => {
    // Sizes
    // Small: ~5x3cm 
    // Large: ~5x5cm
    const containerStyle = size === 'small'
        ? { width: '8cm', height: '3cm', backgroundColor: '#dfd8bc' }
        : { width: '8cm', height: '4cm', backgroundColor: '#dfd8bc' };

    const orgName = institute?.orgName || "YAYASAN DAR EL IMAN";
    const orgLogo = institute?.orgLogo;

    return (
        <div ref={ref} className="p-2 inline-block print:p-0">
            <div style={containerStyle} className="flex items-center justify-between px-4 py-2 rounded-sm relative overflow-hidden">
                {/* Left: QR Code */}
                <div className="bg-white p-1 flex items-center justify-center shrink-0 shadow-sm rounded-sm">
                    <QRCode
                        value={JSON.stringify({ code: asset.code, id: asset.id })}
                        size={size === 'small' ? 70 : 90}
                        level="M"
                    />
                </div>

                {/* Middle: Text + Code Box */}
                <div className="flex-1 flex flex-col items-center justify-center text-center px-4 overflow-hidden">
                    <h2 className="font-bold text-[14px] leading-tight mb-1 uppercase break-words text-slate-900 tracking-wide w-full truncate">
                        {orgName}
                    </h2>
                    <p className="text-[11px] font-bold text-slate-600 mb-1.5 w-full truncate uppercase tracking-tight">
                        {asset?.room?.name || 'TANPA RUANGAN'}
                    </p>
                    <div className="bg-white px-4 py-1.5 rounded-sm shadow-sm border border-slate-300">
                        <p className="font-mono text-[13px] text-black font-bold tracking-wider leading-none">
                            {asset?.code || '-'}
                        </p>
                    </div>
                </div>

                {/* Right: Institute Logo */}
                <div className="flex flex-col items-center justify-center shrink-0 w-[60px]">
                    {orgLogo ? (
                        <img
                            src={orgLogo}
                            alt="Logo"
                            className="w-full h-auto object-contain max-h-[60px]"
                        />
                    ) : (
                        <div className="w-12 h-12 border-2 border-slate-400 rounded-full flex items-center justify-center text-[10px] text-slate-500 font-bold border-dashed uppercase text-center">
                            Logo
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

export const BatchLabelPrint = React.forwardRef(({ assets, institute, layout = '2x4' }, ref) => {
    const orgName = institute?.orgName || "YAYASAN DAR EL IMAN";
    const orgLogo = institute?.orgLogo;

    // Layout configuration
    const getLayoutConfigs = (id) => {
        switch (id) {
            case '2x2': return { cols: 2, width: '95mm', height: '130mm', qr: 120, title: '18pt', room: '14pt', code: '14pt', logo: '80px', padding: '10mm' };
            case '3x4': return { cols: 3, width: '60mm', height: '65mm', qr: 80, title: '11pt', room: '9pt', code: '9pt', logo: '45px', padding: '3mm' };
            case '3x7': return { cols: 3, width: '64mm', height: '38mm', qr: 60, title: '9pt', room: '8pt', code: '8pt', logo: '35px', padding: '2mm' };
            case '3x10': return { cols: 3, width: '64mm', height: '26mm', qr: 45, title: '7pt', room: '6.5pt', code: '7pt', logo: '30px', padding: '1.5mm' };
            case '2x4':
            default: return { cols: 2, width: '90mm', height: '45mm', qr: 90, title: '14pt', room: '11pt', code: '11pt', logo: '60px', padding: '4mm' };
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
                        gap: 5mm;
                        page-break-inside: avoid;
                    }
                    .label-item {
                        width: ${config.width};
                        height: ${config.height};
                        page-break-inside: avoid;
                        background-color: #dfd8bc !important;
                        -webkit-print-color-adjust: exact;
                        padding: ${config.padding};
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        border-radius: 4px;
                    }
                .qr-box { padding: 4px; }
                .org-title { font-size: ${config.title}; }
                .asset-room-label { 
                    font-size: ${config.room}; 
                    font-weight: 700; 
                    color: #475569; 
                    margin-bottom: 2mm;
                    display: -webkit-box;
                    -webkit-line-clamp: 1;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                    text-transform: uppercase;
                }
                .code-text { font-size: ${config.code}; }
                .logo-box { width: ${config.logo}; }
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
                    background-color: #dfd8bc;
                    padding: ${config.padding};
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    border-radius: 6px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .qr-box {
                    background: white;
                    padding: 4px;
                    border-radius: 2px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .text-content {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    padding: 0 4px;
                }
                .org-title {
                    font-weight: bold;
                    color: #000;
                    text-transform: uppercase;
                    margin-bottom: 1.5mm;
                    line-height: 1.1;
                    width: 100%;
                    font-size: ${config.title};
                }
                .code-box {
                    background: white;
                    padding: 1mm 3mm;
                    border-radius: 1mm;
                    border: 0.5px solid #ccc;
                }
                .code-text {
                    font-family: 'Courier New', monospace;
                    font-weight: bold;
                    color: #000;
                    font-size: ${config.code};
                }
                .logo-box {
                    width: ${config.logo};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .logo-img {
                    width: 100%;
                    height: auto;
                    max-height: ${config.logo};
                    object-fit: contain;
                }
            `}</style>
            {assets.map(asset => (
                <div key={asset.id} className="label-item">
                    {/* Left: QR */}
                    <div className="qr-box">
                        <QRCode
                            value={JSON.stringify({
                                code: asset?.code || '-',
                                id: asset?.id,
                                name: asset?.name
                            })}
                            size={config.qr}
                            level="M"
                        />
                    </div>

                    {/* Middle: Info */}
                    <div className="text-content">
                        <h2 className="org-title">{orgName}</h2>
                        <div className="asset-room-label">{asset?.room?.name || 'Tanpa Ruangan'}</div>
                        <div className="code-box">
                            <span className="code-text">{asset?.code || '-'}</span>
                        </div>
                    </div>

                    {/* Right: Logo */}
                    <div className="logo-box">
                        {orgLogo ? (
                            <img src={orgLogo} alt="Logo" className="logo-img" />
                        ) : (
                            <div className="w-8 h-8 border-2 border-slate-400 rounded-full border-dashed" />
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
});
