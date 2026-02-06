import React from 'react';
import QRCode from 'react-qr-code';

export const LabelPrint = React.forwardRef(({ asset, size = 'small' }, ref) => {
    // Sizes
    // Small: ~3x5cm (approx 113px x 189px at 96dpi)
    // Large: ~5x5cm (approx 189px x 189px)

    // CSS for print media ensures actual size
    const containerStyle = size === 'small'
        ? { width: '5cm', height: '3cm' }
        : { width: '5cm', height: '5cm' };

    return (
        <div ref={ref} className="bg-white p-2 border border-slate-200 inline-block print:border-none">
            <div style={containerStyle} className="flex flex-col items-center justify-center p-2 border-2 border-slate-800 rounded-sm">
                <div className="flex w-full gap-2 items-center h-full">
                    <div className="bg-white p-1">
                        <QRCode
                            value={JSON.stringify({ code: asset.code, id: asset.id })}
                            size={size === 'small' ? 70 : 100}
                            level="M"
                        />
                    </div>
                    <div className="flex-1 flex flex-col justify-center overflow-hidden">
                        <h4 className="font-bold text-xs uppercase leading-tight mb-0.5 truncate">{asset.name}</h4>
                        <p className="font-mono text-[10px] text-slate-600 mb-1">{asset.code}</p>
                        <hr className="border-slate-300 w-full my-0.5" />
                        <p className="text-[9px] text-slate-500 truncate">{asset.unit}</p>
                        <p className="text-[8px] text-slate-400 mt-0.5 ml-auto">{new Date().toLocaleDateString('id-ID')}</p>
                    </div>
                </div>
            </div>
        </div>
    );
});

export const BatchLabelPrint = React.forwardRef(({ assets }, ref) => {
    return (
        <div ref={ref} className="p-4 grid grid-cols-2 gap-4 print:grid-cols-2 print:gap-4">
            {assets.map(asset => (
                <div key={asset.id} className="break-inside-avoid">
                    <div style={{ width: '5cm', height: '3cm' }} className="flex flex-col items-center justify-center p-2 border border-slate-800 rounded-sm">
                        <div className="flex w-full gap-2 items-center h-full">
                            <div className="bg-white p-1">
                                <QRCode value={asset.code} size={64} level="M" />
                            </div>
                            <div className="flex-1 flex flex-col justify-center overflow-hidden text-left">
                                <h4 className="font-bold text-[10px] uppercase leading-tight mb-0.5 truncate">{asset.name.substring(0, 18)}</h4>
                                <p className="font-mono text-[9px] text-slate-600 font-bold">{asset.code}</p>
                                <p className="text-[8px] text-slate-500 truncate w-full">{asset.location || asset.unit}</p>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
});
