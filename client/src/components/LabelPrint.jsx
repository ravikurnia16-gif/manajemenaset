import React from 'react';
import QRCode from 'react-qr-code';

export const LabelPrint = React.forwardRef(({ asset, size = 'small', institute }, ref) => {
    const config = size === 'mini'
        ? {
            width: '40mm', height: '30mm',
            qr: 55, fontSize: { title: 'text-[8px]', name: 'text-[10px]', room: 'text-[8px]', code: 'text-[9px]' },
            padding: 'p-1.5'
        }
        : size === 'small'
            ? {
                width: '50mm', height: '35mm',
                qr: 75, fontSize: { title: 'text-[9px]', name: 'text-[12px]', room: 'text-[9px]', code: 'text-[10px]' },
                padding: 'p-2'
            }
            : {
                width: '60mm', height: '40mm',
                qr: 95, fontSize: { title: 'text-[11px]', name: 'text-[14px]', room: 'text-[11px]', code: 'text-[12px]' },
                padding: 'p-3'
            };

    const orgName = institute?.name || institute?.orgName || "YAYASAN DAR EL IMAN";

    return (
        <div ref={ref} className="p-2 inline-block print:p-0 bg-white">
            <div
                className={`flex flex-col items-center justify-between border-2 border-black bg-white text-black font-bold uppercase overflow-hidden ${config.padding}`}
                style={{ width: config.width, height: config.height }}
            >
                {/* Header: Institution */}
                <div className="w-full border-b-2 border-black pb-1 mb-1 text-center shrink-0">
                    <h2 className={`${config.fontSize.title} tracking-wider truncate`}>
                        {orgName}
                    </h2>
                </div>

                {/* Body: Asset Name & QR Code */}
                <div className="flex-1 flex flex-col items-center justify-center w-full gap-1 overflow-hidden">
                    <div className="w-full text-center border-b border-black/20 pb-0.5">
                        <span className={`${config.fontSize.name} leading-tight line-clamp-1`}>{asset?.name}</span>
                    </div>

                    <div className="p-1 border border-black rounded-sm bg-white shrink-0">
                        <QRCode
                            value={`${window.location.origin}/public/asset/${asset?.id}`}
                            size={config.qr}
                            level="H"
                        />
                    </div>
                </div>

                {/* Footer: Room & Asset Code */}
                <div className="w-full mt-1 pt-1 border-t-2 border-black flex flex-col items-center shrink-0">
                    <div className="w-full text-center border-b border-black/10 pb-0.5 mb-0.5">
                        <span className={`${config.fontSize.room} truncate`}>{asset?.room?.name || '-'}</span>
                    </div>
                    <div className="w-full text-center">
                        <span className={`${config.fontSize.code} tracking-widest font-mono`}>{asset?.code || '-'}</span>
                    </div>
                </div>
            </div>
        </div>
    );
});

export const BatchLabelPrint = React.forwardRef(({ assets, institute, layout = '2x4', customConfig = null }, ref) => {
    const orgName = institute?.name || institute?.orgName || "YAYASAN DAR EL IMAN";

    const getLayoutConfigs = (id) => {
        if (id === 'custom' && customConfig) {
            const cols = parseInt(customConfig.columns) || 3;
            const w = parseInt(customConfig.width) || 60;
            const h = parseInt(customConfig.height) || 40;

            // Dynamic sizing based on dimensions
            const qrSize = Math.floor(Math.min(w, h) * 1.8);
            return {
                cols,
                width: `${w}mm`,
                height: `${h}mm`,
                qr: qrSize,
                fontSize: {
                    title: w < 45 ? 'text-[7px]' : 'text-[10px]',
                    name: w < 45 ? 'text-[9px]' : 'text-[13px]',
                    room: w < 45 ? 'text-[7px]' : 'text-[10px]',
                    code: w < 45 ? 'text-[8px]' : 'text-[11px]'
                },
                padding: w < 45 ? 'p-1' : 'p-2'
            };
        }

        switch (id) {
            case '2x2': return { cols: 2, width: '90mm', height: '125mm', qr: 180, fontSize: { title: 'text-[16px]', name: 'text-[24px]', room: 'text-[16px]', code: 'text-[20px]' }, padding: 'p-6' };
            case '3x4': return { cols: 3, width: '60mm', height: '70mm', qr: 120, fontSize: { title: 'text-[12px]', name: 'text-[18px]', room: 'text-[12px]', code: 'text-[14px]' }, padding: 'p-4' };
            case '3x7': return { cols: 3, width: '60mm', height: '42mm', qr: 95, fontSize: { title: 'text-[10px]', name: 'text-[14px]', room: 'text-[10px]', code: 'text-[12px]' }, padding: 'p-3' };
            case '3x10': return { cols: 3, width: '60mm', height: '29mm', qr: 55, fontSize: { title: 'text-[8px]', name: 'text-[10px]', room: 'text-[8px]', code: 'text-[9px]' }, padding: 'p-1.5' };
            case '4x14': return { cols: 4, width: '48mm', height: '20mm', qr: 45, fontSize: { title: 'text-[6px]', name: 'text-[8px]', room: 'text-[6px]', code: 'text-[7px]' }, padding: 'p-1' };
            case '2x4':
            default: return { cols: 2, width: '90mm', height: '70mm', qr: 150, fontSize: { title: 'text-[14px]', name: 'text-[20px]', room: 'text-[14px]', code: 'text-[18px]' }, padding: 'p-4' };
        }
    };

    const config = getLayoutConfigs(layout);

    return (
        <div ref={ref} className="bg-white print:m-0 w-full overflow-hidden">
            <style>{`
                @media print {
                    @page { size: auto; margin: 5mm; }
                    .print-page-break { page-break-inside: avoid; }
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
                        className="print-page-break flex items-center justify-center p-[0.5mm]"
                        style={{ width: config.width, height: config.height }}
                    >
                        <div className={`w-full h-full ${config.padding} border-2 border-black flex flex-col items-center justify-between text-black font-bold uppercase overflow-hidden bg-white`}>
                            {/* Header */}
                            <div className="w-full border-b-2 border-black pb-0.5 mb-0.5 text-center shrink-0">
                                <h2 className={`${config.fontSize.title} tracking-tight truncate`}>
                                    {orgName}
                                </h2>
                            </div>

                            {/* Body */}
                            <div className="flex-1 flex flex-col items-center justify-center w-full gap-0.5 overflow-hidden">
                                <div className="w-full text-center border-b border-black/10">
                                    <span className={`${config.fontSize.name} leading-tight line-clamp-1`}>{asset.name}</span>
                                </div>
                                <div className="p-0.5 border border-black rounded-[1px] bg-white shrink-0">
                                    <QRCode
                                        value={`${window.location.origin}/public/asset/${asset?.id}`}
                                        size={config.qr}
                                        level="H"
                                    />
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="w-full mt-0.5 pt-0.5 border-t border-black flex flex-col items-center shrink-0">
                                <div className="w-full text-center border-b border-black/5 pb-0.5 mb-0.5">
                                    <span className={`${config.fontSize.room} truncate`}>{asset.room?.name || '-'}</span>
                                </div>
                                <div className="w-full text-center">
                                    <span className={`${config.fontSize.code} tracking-tighter font-mono`}>{asset.code || '-'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
});
