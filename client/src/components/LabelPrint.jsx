import React from 'react';
import QRCode from 'react-qr-code';

// Paper dimensions in mm (width x height)
const PAPER_DIMENSIONS = {
    'A3': { w: 297, h: 420 },
    'A4': { w: 210, h: 297 },
    'A5': { w: 148, h: 210 },
    'B4': { w: 250, h: 353 },
    'B5': { w: 176, h: 250 },
    'F4': { w: 215.9, h: 330.2 },
    'letter': { w: 215.9, h: 279.4 },
    'legal': { w: 215.9, h: 355.6 },
};

const MARGIN = 6; // mm total margin (3mm each side)

// Helper: calculate font/qr sizes from label dimensions in mm
function calcSizes(wMm, hMm) {
    const mmToPx = 3.78;
    const minDim = Math.min(wMm, hMm);
    // QR should occupy ~50% of the smaller dimension
    const qr = Math.max(Math.floor((hMm - 12) * mmToPx * 0.65), 30);
    const logo = Math.max(Math.floor(qr * 0.22), 8);
    // Font sizes scale with width
    const base = Math.max(wMm / 7, 4);
    return {
        qr,
        logoSize: logo,
        title: `${(base * 0.85).toFixed(1)}px`,
        name: `${(base * 1.1).toFixed(1)}px`,
        room: `${(base * 0.85).toFixed(1)}px`,
        code: `${(base * 0.95).toFixed(1)}px`,
        gap: `${Math.max(minDim * 0.03, 0.5).toFixed(1)}mm`,
        pad: `${Math.max(minDim * 0.04, 0.5).toFixed(1)}mm`,
    };
}

export const LabelPrint = React.forwardRef(({ asset, size = 'small', institute }, ref) => {
    const config = size === 'mini'
        ? { width: '40mm', height: '30mm', ...calcSizes(40, 30) }
        : size === 'small'
            ? { width: '50mm', height: '35mm', ...calcSizes(50, 35) }
            : { width: '60mm', height: '40mm', ...calcSizes(60, 40) };

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
                <div style={{ fontSize: config.title, letterSpacing: '0.5px', textAlign: 'center', width: '100%', flexShrink: 0, lineHeight: 1.2 }}>
                    {orgName}
                </div>
                <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: config.gap, marginBottom: config.gap, flexShrink: 0 }}>
                    <QRCode value={`${window.location.origin}/public/asset/${asset?.id}`} size={config.qr} level="H" />
                    {orgLogo && (
                        <div style={{ position: 'absolute', backgroundColor: '#fff', padding: '1px', borderRadius: '2px', width: config.logoSize, height: config.logoSize, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <img src={orgLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        </div>
                    )}
                </div>
                <div style={{ fontSize: config.room, textAlign: 'center', width: '100%', flexShrink: 0, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {asset?.room?.name || '-'}
                </div>
                <div style={{ fontSize: config.name, textAlign: 'center', width: '100%', flexShrink: 0, lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px', marginBottom: '1px', fontWeight: '800' }}>
                    {asset?.name || '-'}
                </div>
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

    const paper = PAPER_DIMENSIONS[paperSize] || PAPER_DIMENSIONS['A4'];
    const usableW = paper.w - MARGIN;
    const usableH = paper.h - MARGIN;

    const pageSizeCSS = `${paper.w}mm ${paper.h}mm`;

    const getLayoutConfigs = (id) => {
        if (id === 'custom' && customConfig) {
            const cols = parseInt(customConfig.columns) || 3;
            const w = parseInt(customConfig.width) || 60;
            const h = parseInt(customConfig.height) || 40;
            return { cols, rows: null, wMm: w, hMm: h, ...calcSizes(w, h) };
        }

        // Parse layout like "3x7" => cols=3, rows=7
        const match = id.match(/^(\d+)x(\d+)$/);
        if (match) {
            const cols = parseInt(match[1]);
            const rows = parseInt(match[2]);
            // Calculate exact label dimensions from paper size
            const wMm = Math.floor((usableW / cols) * 100) / 100;
            const hMm = Math.floor((usableH / rows) * 100) / 100;
            return { cols, rows, wMm, hMm, ...calcSizes(wMm, hMm) };
        }

        // Fallback
        const wMm = Math.floor((usableW / 2) * 100) / 100;
        const hMm = Math.floor((usableH / 4) * 100) / 100;
        return { cols: 2, rows: 4, wMm, hMm, ...calcSizes(wMm, hMm) };
    };

    const config = getLayoutConfigs(layout);
    const labelsPerPage = config.rows ? config.cols * config.rows : null;

    // Split assets into pages
    const pages = [];
    if (labelsPerPage) {
        for (let i = 0; i < assets.length; i += labelsPerPage) {
            pages.push(assets.slice(i, i + labelsPerPage));
        }
    } else {
        pages.push(assets); // custom: no pagination
    }

    const labelWidth = `${config.wMm}mm`;
    const labelHeight = `${config.hMm}mm`;

    return (
        <div ref={ref} style={{ background: '#fff', width: '100%', overflow: 'hidden' }}>
            <style>{`
                @media print {
                    @page { size: ${pageSizeCSS}; margin: ${MARGIN / 2}mm; }
                    * { box-sizing: border-box !important; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 0; }
                    .batch-page { page-break-after: always; }
                    .batch-page:last-child { page-break-after: auto; }
                }
            `}</style>
            {pages.map((pageAssets, pageIndex) => (
                <div
                    key={pageIndex}
                    className="batch-page"
                    style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${config.cols}, ${labelWidth})`,
                        gridAutoRows: labelHeight,
                        width: '100%',
                        gap: '0px',
                        justifyContent: 'center',
                    }}
                >
                    {pageAssets.map((asset, index) => (
                        <div
                            key={`${asset.id}-${index}`}
                            style={{
                                width: labelWidth, height: labelHeight,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                        >
                            <div style={{
                                width: '100%', height: '100%', padding: config.pad,
                                border: '1.5px solid #000', backgroundColor: '#fff',
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

                                {/* Asset Name */}
                                <div style={{ fontSize: config.name, textAlign: 'center', width: '100%', flexShrink: 0, lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px', marginBottom: '1px', fontWeight: '800' }}>
                                    {asset.name || '-'}
                                </div>

                                {/* Asset Code */}
                                <div style={{ fontSize: config.code, fontFamily: "'Courier New', monospace", letterSpacing: '0.5px', textAlign: 'center', width: '100%', flexShrink: 0, lineHeight: 1.2 }}>
                                    {asset.code || '-'}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
});
