import React from 'react';
import QRCode from 'react-qr-code';

export const LabelPrint = React.forwardRef(({ asset, size = 'small', institute }, ref) => {
    const config = size === 'mini'
        ? { width: '40mm', height: '30mm', qr: 52, logoSize: 14, title: '7.5px', name: '9px', room: '7.5px', code: '8.5px', gap: '1.5mm', pad: '1.5mm' }
        : size === 'small'
            ? { width: '50mm', height: '35mm', qr: 70, logoSize: 18, title: '8.5px', name: '11px', room: '8.5px', code: '9.5px', gap: '2mm', pad: '2mm' }
            : { width: '60mm', height: '40mm', qr: 90, logoSize: 22, title: '10px', name: '13px', room: '10px', code: '11px', gap: '2.5mm', pad: '3mm' };

    const orgName = institute?.name || institute?.orgName || "YAYASAN DAR EL IMAN";
    const orgLogo = institute?.orgLogo;

    return (
        <div ref={ref} className="p-2 inline-block print:p-0 bg-white">
            <style>{`
                @media print {
                    * { box-sizing: border-box !important; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            `}</style>
            <div style={{
                width: config.width, height: config.height, padding: config.pad,
                border: '2px solid #000', backgroundColor: '#fff',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
                fontFamily: 'Arial, Helvetica, sans-serif', fontWeight: 'bold', textTransform: 'uppercase',
                overflow: 'hidden', boxSizing: 'border-box'
            }}>
                {/* Title */}
                <div style={{ fontSize: config.title, letterSpacing: '0.5px', textAlign: 'center', width: '100%', flexShrink: 0, lineHeight: 1.2 }}>
                    {orgName}
                </div>

                {/* QR Code with Logo Overlay */}
                <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: config.gap, marginBottom: config.gap, flexShrink: 0 }}>
                    <QRCode
                        value={`${window.location.origin}/public/asset/${asset?.id}`}
                        size={config.qr}
                        level="H"
                    />
                    {orgLogo && (
                        <div style={{
                            position: 'absolute', backgroundColor: '#fff', padding: '1px', borderRadius: '2px',
                            width: config.logoSize, height: config.logoSize,
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <img src={orgLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        </div>
                    )}
                </div>

                {/* Room */}
                <div style={{ fontSize: config.room, textAlign: 'center', width: '100%', flexShrink: 0, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {asset?.room?.name || '-'}
                </div>

                {/* Asset Code */}
                <div style={{ fontSize: config.code, fontFamily: "'Courier New', monospace", letterSpacing: '1px', textAlign: 'center', width: '100%', flexShrink: 0, lineHeight: 1.2 }}>
                    {asset?.code || '-'}
                </div>
            </div>
        </div>
    );
});

export const BatchLabelPrint = React.forwardRef(({ assets, institute, layout = '2x4', customConfig = null, paperSize = 'A4' }, ref) => {
    const orgName = institute?.name || institute?.orgName || "YAYASAN DAR EL IMAN";
    const orgLogo = institute?.orgLogo;

    // Paper size CSS values
    const paperSizeMap = {
        'A3': '297mm 420mm',
        'A4': '210mm 297mm',
        'A5': '148mm 210mm',
        'B4': '250mm 353mm',
        'B5': '176mm 250mm',
        'F4': '215.9mm 330.2mm',
        'letter': '215.9mm 279.4mm',
        'legal': '215.9mm 355.6mm',
    };
    const pageSizeCSS = paperSizeMap[paperSize] || paperSizeMap['A4'];

    const getLayoutConfigs = (id) => {
        if (id === 'custom' && customConfig) {
            const cols = parseInt(customConfig.columns) || 3;
            const w = parseInt(customConfig.width) || 60;
            const h = parseInt(customConfig.height) || 40;
            const mmToPx = 3.6;
            const availableH = h - 14;
            const qr = Math.max(Math.floor(Math.min(availableH, w * 0.6) * mmToPx), 40);
            const logo = Math.floor(qr * 0.22);
            return {
                cols, width: `${w}mm`, height: `${h}mm`, qr, logoSize: logo,
                title: w < 40 ? '6.5px' : '9px', name: w < 40 ? '8.5px' : '12px',
                room: w < 40 ? '6.5px' : '9px', code: w < 40 ? '7.5px' : '10px',
                gap: w < 40 ? '0.5mm' : '1.5mm', pad: w < 40 ? '0.5mm' : '1.5mm'
            };
        }
        const presets = {
            '2x2': { cols: 2, width: '90mm', height: '125mm', qr: 180, logoSize: 40, title: '16px', name: '22px', room: '14px', code: '18px', gap: '4mm', pad: '6mm' },
            '3x4': { cols: 3, width: '60mm', height: '70mm', qr: 120, logoSize: 28, title: '11px', name: '16px', room: '11px', code: '13px', gap: '3mm', pad: '4mm' },
            '3x7': { cols: 3, width: '60mm', height: '42mm', qr: 90, logoSize: 22, title: '10px', name: '13px', room: '9px', code: '11px', gap: '2mm', pad: '3mm' },
            '3x10': { cols: 3, width: '60mm', height: '29mm', qr: 52, logoSize: 14, title: '7.5px', name: '9px', room: '7.5px', code: '8.5px', gap: '1.5mm', pad: '1.5mm' },
            '4x14': { cols: 4, width: '48mm', height: '21mm', qr: 42, logoSize: 11, title: '6px', name: '8px', room: '6px', code: '7px', gap: '1mm', pad: '1mm' },
            '2x4': { cols: 2, width: '90mm', height: '70mm', qr: 150, logoSize: 34, title: '14px', name: '18px', room: '13px', code: '16px', gap: '3mm', pad: '4mm' },
        };
        return presets[id] || presets['2x4'];
    };

    const config = getLayoutConfigs(layout);

    return (
        <div ref={ref} style={{ background: '#fff', width: '100%', overflow: 'hidden' }}>
            <style>{`
                @media print {
                    @page { size: ${pageSizeCSS}; margin: 3mm; }
                    * { box-sizing: border-box !important; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            `}</style>
            <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${config.cols}, 1fr)`,
                width: '100%',
                gap: '0.5mm'
            }}>
                {assets.map((asset, index) => (
                    <div
                        key={`${asset.id}-${index}`}
                        style={{
                            width: config.width, height: config.height,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            pageBreakInside: 'avoid'
                        }}
                    >
                        <div style={{
                            width: '100%', height: '100%', padding: config.pad,
                            border: '2px solid #000', backgroundColor: '#fff',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
                            fontFamily: 'Arial, Helvetica, sans-serif', fontWeight: 'bold', textTransform: 'uppercase',
                            overflow: 'hidden', boxSizing: 'border-box'
                        }}>
                            {/* Title */}
                            <div style={{ fontSize: config.title, letterSpacing: '0.3px', textAlign: 'center', width: '100%', flexShrink: 0, lineHeight: 1.2 }}>
                                {orgName}
                            </div>

                            {/* QR Code with Logo */}
                            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: config.gap, marginBottom: config.gap, flexShrink: 0 }}>
                                <QRCode
                                    value={`${window.location.origin}/public/asset/${asset?.id}`}
                                    size={config.qr}
                                    level="H"
                                />
                                {orgLogo && (
                                    <div style={{
                                        position: 'absolute', backgroundColor: '#fff', padding: '1px', borderRadius: '2px',
                                        width: config.logoSize, height: config.logoSize,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <img src={orgLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                    </div>
                                )}
                            </div>

                            {/* Room */}
                            <div style={{ fontSize: config.room, textAlign: 'center', width: '100%', flexShrink: 0, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {asset.room?.name || '-'}
                            </div>

                            {/* Asset Code */}
                            <div style={{ fontSize: config.code, fontFamily: "'Courier New', monospace", letterSpacing: '0.5px', textAlign: 'center', width: '100%', flexShrink: 0, lineHeight: 1.2 }}>
                                {asset.code || '-'}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
});
