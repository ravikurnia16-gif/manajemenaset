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
                        <h4 className="font-bold text-xs uppercase leading-tight mb-0.5 truncate">{asset?.name || '-'}</h4>
                        <p className="font-mono text-[10px] text-slate-600 mb-1">{asset?.code || '-'}</p>
                        <hr className="border-slate-300 w-full my-0.5" />
                        <p className="text-[9px] text-slate-500 truncate">{asset?.unit?.name || asset?.unit || '-'}</p>
                        <p className="text-[8px] text-slate-400 mt-0.5 ml-auto">{new Date().toLocaleDateString('id-ID')}</p>
                    </div>
                </div>
            </div>
        </div>
    );
});

export const BatchLabelPrint = React.forwardRef(({ assets }, ref) => {
    return (
        <div ref={ref} className="print-container">
            <style>{`
                @media print {
                    @page {
                        size: A4;
                        margin: 8mm;
                    }
                    .print-container {
                        width: 100%;
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: 6mm;
                        page-break-inside: avoid;
                    }
                    .label-item {
                        width: 65mm;
                        height: 55mm;
                        page-break-inside: avoid;
                        border: 2px solid #1e293b;
                        border-radius: 4px;
                        padding: 4mm;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: space-between;
                        background: white;
                    }
                    .qr-section {
                        flex-shrink: 0;
                        padding: 2mm;
                        background: white;
                    }
                    .info-section {
                        width: 100%;
                        text-align: center;
                        margin-top: 2mm;
                    }
                    .asset-code {
                        font-family: 'Courier New', monospace;
                        font-size: 10pt;
                        font-weight: bold;
                        color: #1e293b;
                        margin-bottom: 1.5mm;
                    }
                    .asset-name {
                        font-size: 9pt;
                        font-weight: bold;
                        color: #334155;
                        margin-bottom: 1.5mm;
                        line-height: 1.2;
                        max-height: 2.4em;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                    .asset-meta {
                        font-size: 8pt;
                        color: #64748b;
                        border-top: 1px solid #e2e8f0;
                        padding-top: 1.5mm;
                        margin-top: 1.5mm;
                    }
                    .category-badge {
                        display: inline-block;
                        background: #dbeafe;
                        color: #1e40af;
                        padding: 1.5mm 3mm;
                        border-radius: 2mm;
                        font-size: 7pt;
                        font-weight: bold;
                        margin-bottom: 1.5mm;
                    }
                }
                
                /* Screen preview styles */
                .print-container {
                    padding: 20px;
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 16px;
                    max-width: 210mm;
                    margin: 0 auto;
                    background: #f8fafc;
                }
                .label-item {
                    width: 100%;
                    aspect-ratio: 13/11;
                    border: 2px solid #1e293b;
                    border-radius: 6px;
                    padding: 14px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: space-between;
                    background: white;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .qr-section {
                    flex-shrink: 0;
                    padding: 8px;
                    background: white;
                }
                .info-section {
                    width: 100%;
                    text-align: center;
                    margin-top: 8px;
                }
                .asset-code {
                    font-family: 'Courier New', monospace;
                    font-size: 12px;
                    font-weight: bold;
                    color: #1e293b;
                    margin-bottom: 5px;
                }
                .asset-name {
                    font-size: 11px;
                    font-weight: bold;
                    color: #334155;
                    margin-bottom: 5px;
                    line-height: 1.3;
                    max-height: 2.6em;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                }
                .asset-meta {
                    font-size: 9px;
                    color: #64748b;
                    border-top: 1px solid #e2e8f0;
                    padding-top: 5px;
                    margin-top: 5px;
                }
                .category-badge {
                    display: inline-block;
                    background: #dbeafe;
                    color: #1e40af;
                    padding: 3px 8px;
                    border-radius: 3px;
                    font-size: 8px;
                    font-weight: bold;
                    margin-bottom: 5px;
                }
            `}</style>
            {assets.map(asset => (
                <div key={asset.id} className="label-item">
                    <div className="qr-section">
                        <QRCode
                            value={JSON.stringify({
                                code: asset?.code || '-',
                                id: asset?.id,
                                name: asset?.name
                            })}
                            size={100}
                            level="M"
                        />
                    </div>
                    <div className="info-section">
                        <div className="asset-code">{asset?.code || '-'}</div>
                        <div className="asset-name">{asset?.name || 'Unnamed Asset'}</div>
                        <div className="category-badge">{asset?.category?.name || 'Uncategorized'}</div>
                    </div>
                </div>
            ))}
        </div>
    );
});
