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
                <div className="flex-1 flex flex-col items-center justify-center text-center px-2">
                    <h2 className="font-bold text-[14px] leading-tight mb-2 uppercase break-words text-slate-900 tracking-wide">
                        {orgName}
                    </h2>
                    <div className="bg-white px-3 py-1 rounded-sm shadow-sm border border-slate-300">
                        <p className="font-mono text-[12px] text-black font-bold tracking-wider leading-none">
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

export const BatchLabelPrint = React.forwardRef(({ assets, institute }, ref) => {
    const orgName = institute?.orgName || "YAYASAN DAR EL IMAN";
    const orgLogo = institute?.orgLogo;

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
                        grid-template-columns: repeat(2, 1fr);
                        gap: 8mm;
                        page-break-inside: avoid;
                    }
                    .label-item {
                        width: 90mm;
                        height: 45mm;
                        page-break-inside: avoid;
                        background-color: #dfd8bc !important;
                        -webkit-print-color-adjust: exact;
                        padding: 4mm;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        border-radius: 4px;
                    }
                }
                
                .print-container {
                    padding: 20px;
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 16px;
                    max-width: 210mm;
                    margin: 0 auto;
                }
                .label-item {
                    width: 100%;
                    aspect-ratio: 2/1;
                    background-color: #dfd8bc;
                    padding: 16px;
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
                    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                }
                .text-content {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    padding: 0 8px;
                }
                .org-title {
                    font-size: 14pt;
                    font-weight: bold;
                    color: #000;
                    text-transform: uppercase;
                    margin-bottom: 2mm;
                    line-height: 1.1;
                    width: 100%;
                }
                .code-box {
                    background: white;
                    padding: 1.5mm 4mm;
                    border-radius: 1mm;
                    border: 0.5px solid #ccc;
                }
                .code-text {
                    font-family: 'Courier New', monospace;
                    font-size: 11pt;
                    font-weight: bold;
                    color: #000;
                }
                .logo-box {
                    width: 65px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .logo-img {
                    width: 100%;
                    height: auto;
                    max-height: 60px;
                    object-contain: true;
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
                            size={90}
                            level="M"
                        />
                    </div>

                    {/* Middle: Info */}
                    <div className="text-content">
                        <h2 className="org-title">{orgName}</h2>
                        <div className="code-box">
                            <span className="code-text">{asset?.code || '-'}</span>
                        </div>
                    </div>

                    {/* Right: Logo */}
                    <div className="logo-box">
                        {orgLogo ? (
                            <img src={orgLogo} alt="Logo" className="logo-img" />
                        ) : (
                            <div className="w-12 h-12 border-2 border-slate-400 rounded-full border-dashed" />
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
});
