import React from 'react';
import QRCode from 'react-qr-code';

export const LabelPrint = React.forwardRef(({ asset, size = 'small', institute }, ref) => {
    // Standard configurations with more precise scaling
    const config = size === 'mini'
        ? {
            width: '40mm', height: '30mm',
            qr: 52, fontSize: { title: 'text-[7.5px]', name: 'text-[9.2px]', room: 'text-[7.5px]', code: 'text-[8.5px]' },
            padding: 'p-1'
        }
        : size === 'small'
            ? {
                width: '50mm', height: '35mm',
                qr: 70, fontSize: { title: 'text-[8.5px]', name: 'text-[11.5px]', room: 'text-[8.5px]', code: 'text-[9.5px]' },
                padding: 'p-1.5'
            }
            : {
                width: '60mm', height: '40mm',
                qr: 90, fontSize: { title: 'text-[10.5px]', name: 'text-[13.5px]', room: 'text-[10.5px]', code: 'text-[11.5px]' },
                padding: 'p-2'
            };

    const orgName = institute?.name || institute?.orgName || "YAYASAN DAR EL IMAN";

    return (
        <div ref={ref} className="p-2 inline-block print:p-0 bg-white">
            <style>{`
                @media print {
                    * { box-sizing: border-box !important; }
                    body { -webkit-print-color-adjust: exact; }
                }
            `}</style>
            <div
                className={`flex flex-col items-center justify-between border-2 border-black bg-white text-black font-bold uppercase overflow-hidden ${config.padding}`}
                style={{ width: config.width, height: config.height }}
            >
                {/* Single Box - No Internal Borders */}
                <h2 className={`${config.fontSize.title} tracking-wider w-full text-center truncate shrink-0`}>
                    {orgName}
                </h2>

                <div className="flex-1 flex flex-col items-center justify-center w-full min-h-0 gap-1">
                    <span className={`${config.fontSize.name} leading-tight text-center line-clamp-1 w-full`}>{asset?.name}</span>
                    <div className="bg-white inline-flex items-center justify-center shrink-0">
                        <QRCode
                            value={`${window.location.origin}/public/asset/${asset?.id}`}
                            size={config.qr}
                            level="H"
                        />
                    </div>
                </div>

                <div className="w-full flex flex-col items-center shrink-0 gap-0.5">
                    <span className={`${config.fontSize.room} truncate w-full text-center`}>{asset?.room?.name || '-'}</span>
                    <span className={`${config.fontSize.code} tracking-widest font-mono w-full text-center`}>{asset?.code || '-'}</span>
                </div>
            </div>
        </div>
    );
});

export const BatchLabelPrint = React.forwardRef(({ assets, institute, layout = '2x4', customConfig = null, paperSize = 'A4' }, ref) => {
    const orgName = institute?.name || institute?.orgName || "YAYASAN DAR EL IMAN";

    const getLayoutConfigs = (id) => {
        if (id === 'custom' && customConfig) {
            const cols = parseInt(customConfig.columns) || 3;
            const w = parseInt(customConfig.width) || 60;
            const h = parseInt(customConfig.height) || 40;
            const mmToPx = 3.6;
            const availableHeightMm = h - 14;
            const qrSizePx = Math.floor(Math.min(availableHeightMm, w * 0.6) * mmToPx);

            return {
                cols,
                width: `${w}mm`,
                height: `${h}mm`,
                qr: Math.max(qrSizePx, 40),
                fontSize: {
                    title: w < 40 ? 'text-[6.5px]' : 'text-[9px]',
                    name: w < 40 ? 'text-[8.5px]' : 'text-[12px]',
                    room: w < 40 ? 'text-[6.5px]' : 'text-[9px]',
                    code: w < 40 ? 'text-[7.5px]' : 'text-[10px]'
                },
                padding: w < 40 ? 'p-0.5' : 'p-1.5'
            };
        }

        switch (id) {
            case '2x2': return { cols: 2, width: '90mm', height: '125mm', qr: 180, fontSize: { title: 'text-[16px]', name: 'text-[24px]', room: 'text-[16px]', code: 'text-[20px]' }, padding: 'p-6' };
            case '3x4': return { cols: 3, width: '60mm', height: '70mm', qr: 120, fontSize: { title: 'text-[12px]', name: 'text-[18px]', room: 'text-[12px]', code: 'text-[14px]' }, padding: 'p-4' };
            case '3x7': return { cols: 3, width: '60mm', height: '42mm', qr: 90, fontSize: { title: 'text-[10px]', name: 'text-[14px]', room: 'text-[10px]', code: 'text-[12px]' }, padding: 'p-3' };
            case '3x10': return { cols: 3, width: '60mm', height: '29mm', qr: 52, fontSize: { title: 'text-[7.5px]', name: 'text-[9px]', room: 'text-[7.5px]', code: 'text-[8.5px]' }, padding: 'p-1' };
            case '4x14': return { cols: 4, width: '48mm', height: '21mm', qr: 42, fontSize: { title: 'text-[6px]', name: 'text-[8px]', room: 'text-[6px]', code: 'text-[7px]' }, padding: 'p-1' };
            case '2x4':
            default: return { cols: 2, width: '90mm', height: '70mm', qr: 150, fontSize: { title: 'text-[14px]', name: 'text-[20px]', room: 'text-[14px]', code: 'text-[18px]' }, padding: 'p-4' };
        }
    };

    const config = getLayoutConfigs(layout);

    return (
        <div ref={ref} className="bg-white print:m-0 w-full overflow-hidden">
            <style>{`
                @media print {
                    @page { size: ${paperSize}; margin: 3mm; }
                    .print-page-break { page-break-inside: avoid; }
                    * { box-sizing: border-box !important; }
                    body { -webkit-print-color-adjust: exact; }
                }
            `}</style>
            <div
                className="grid w-full gap-0.5"
                style={{ gridTemplateColumns: `repeat(${config.cols}, 1fr)` }}
            >
                {assets.map((asset, index) => (
                    <div
                        key={`${asset.id}-${index}`}
                        className="print-page-break flex items-center justify-center p-[0.3mm]"
                        style={{ width: config.width, height: config.height }}
                    >
                        <div className={`w-full h-full ${config.padding} border-2 border-black flex flex-col items-center justify-between text-black font-bold uppercase overflow-hidden bg-white`}>
                            {/* Single Box - No Internal Borders */}
                            <h2 className={`${config.fontSize.title} tracking-tight w-full text-center truncate shrink-0`}>
                                {orgName}
                            </h2>

                            <div className="flex-1 flex flex-col items-center justify-center w-full min-h-0 gap-0.5">
                                <span className={`${config.fontSize.name} leading-tight text-center line-clamp-1 w-full`}>{asset.name}</span>
                                <div className="bg-white inline-flex items-center justify-center shrink-0">
                                    <QRCode
                                        value={`${window.location.origin}/public/asset/${asset?.id}`}
                                        size={config.qr}
                                        level="H"
                                    />
                                </div>
                            </div>

                            <div className="w-full flex flex-col items-center shrink-0">
                                <span className={`${config.fontSize.room} truncate w-full text-center`}>{asset.room?.name || '-'}</span>
                                <span className={`${config.fontSize.code} tracking-tighter font-mono w-full text-center`}>{asset.code || '-'}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
});
