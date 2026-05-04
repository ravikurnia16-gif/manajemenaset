import React, { forwardRef, useMemo } from 'react';

const KIRPrint = forwardRef(({ room, unit, assets, settings }, ref) => {
    if (!room) return null;

    const today = new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    // Group assets by name — same name + same brand/condition → 1 row with qty
    const groupedAssets = useMemo(() => {
        const map = new Map();
        (assets || []).forEach(asset => {
            const key = `${(asset.name || '').trim().toLowerCase()}||${(asset.brand || asset.spec || '').trim().toLowerCase()}`;
            if (map.has(key)) {
                const group = map.get(key);
                group.qty += 1;
                group.codes.push(asset.code);
                // Track conditions
                if (asset.condition === 'RUSAK_BERAT') group.worstCondition = 'RUSAK_BERAT';
                else if (asset.condition === 'RUSAK_RINGAN' && group.worstCondition !== 'RUSAK_BERAT') group.worstCondition = 'RUSAK_RINGAN';
                // Collect conditions breakdown
                group.conditionBreakdown[asset.condition] = (group.conditionBreakdown[asset.condition] || 0) + 1;
                // Keep earliest year
                if (asset.purchaseDate) {
                    const yr = new Date(asset.purchaseDate).getFullYear();
                    if (yr < group.earliestYear) group.earliestYear = yr;
                    if (yr > group.latestYear) group.latestYear = yr;
                }
            } else {
                const yr = asset.purchaseDate ? new Date(asset.purchaseDate).getFullYear() : null;
                map.set(key, {
                    name: asset.name,
                    brand: asset.brand || asset.spec || '-',
                    codes: [asset.code],
                    qty: 1,
                    earliestYear: yr || 9999,
                    latestYear: yr || 0,
                    worstCondition: asset.condition || 'BAIK',
                    conditionBreakdown: { [asset.condition || 'BAIK']: 1 },
                    notes: asset.notes || ''
                });
            }
        });
        return Array.from(map.values());
    }, [assets]);

    const conditionLabel = (cond) => {
        if (cond === 'BAIK') return 'B';
        if (cond === 'RUSAK_RINGAN') return 'RR';
        return 'RB';
    };

    const formatConditionBreakdown = (breakdown) => {
        const parts = [];
        if (breakdown['BAIK']) parts.push(`B: ${breakdown['BAIK']}`);
        if (breakdown['RUSAK_RINGAN']) parts.push(`RR: ${breakdown['RUSAK_RINGAN']}`);
        if (breakdown['RUSAK_BERAT']) parts.push(`RB: ${breakdown['RUSAK_BERAT']}`);
        return parts.join(', ');
    };

    return (
        <div ref={ref} className="p-8 bg-white text-black font-serif print:p-6">
            {/* Header */}
            <div className="flex flex-col items-center text-center border-b-2 border-black pb-2 mb-4">
                <h1 className="text-lg font-bold uppercase tracking-wider">{settings?.companyName || 'YAYASAN DAR EL-IMAN'}</h1>
                <h2 className="text-xl font-black mt-0.5">KARTU INVENTARIS RUANGAN (KIR)</h2>
                <div className="w-full flex justify-between mt-2 text-xs font-bold">
                    <div className="text-left">
                        <div className="flex gap-2">
                            <span className="w-24">RUANGAN</span>
                            <span>: {room.name?.toUpperCase()}</span>
                        </div>
                        <div className="flex gap-2">
                            <span className="w-24">UNIT</span>
                            <span>: {unit?.name?.toUpperCase() || '-'}</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="flex gap-2">
                            <span className="w-24">GEDUNG</span>
                            <span>: {room.building?.toUpperCase() || '-'}</span>
                        </div>
                        <div className="flex gap-2">
                            <span className="w-24">LANTAI</span>
                            <span>: {room.floor || '-'}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <table className="w-full border-collapse border-2 border-black text-[11px]">
                <thead>
                    <tr className="bg-slate-100">
                        <th className="border-2 border-black p-1 w-10">NO</th>
                        <th className="border-2 border-black p-1">NAMA BARANG / JENIS</th>
                        <th className="border-2 border-black p-1">MERK / MODEL / TYPE</th>
                        <th className="border-2 border-black p-1 w-14">JML</th>
                        <th className="border-2 border-black p-1 w-20">TAHUN</th>
                        <th className="border-2 border-black p-1 w-28">KONDISI</th>
                        <th className="border-2 border-black p-1">KETERANGAN</th>
                    </tr>
                </thead>
                <tbody>
                    {groupedAssets.length > 0 ? groupedAssets.map((group, index) => (
                        <tr key={index}>
                            <td className="border-2 border-black p-1 text-center">{index + 1}</td>
                            <td className="border-2 border-black p-1 font-bold">{group.name}</td>
                            <td className="border-2 border-black p-1">{group.brand}</td>
                            <td className="border-2 border-black p-1 text-center font-bold">{group.qty}</td>
                            <td className="border-2 border-black p-1 text-center">
                                {group.earliestYear === 9999 ? '-' :
                                    group.earliestYear === group.latestYear ? group.earliestYear :
                                        `${group.earliestYear}-${group.latestYear}`}
                            </td>
                            <td className="border-2 border-black p-1 text-center text-[10px]">
                                {group.qty === 1
                                    ? conditionLabel(group.worstCondition)
                                    : formatConditionBreakdown(group.conditionBreakdown)
                                }
                            </td>
                            <td className="border-2 border-black p-1 text-xs italic">
                                {group.qty === 1 ? (group.codes[0] || '-') : `${group.codes.length} unit`}
                            </td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan="7" className="border-2 border-black p-8 text-center text-slate-400 italic">
                                Tidak ada data aset di ruangan ini
                            </td>
                        </tr>
                    ))}
                </tbody>
                {/* Footer Row: Total */}
                <tfoot>
                    <tr className="bg-slate-50 font-bold">
                        <td colSpan="3" className="border-2 border-black p-1 text-right uppercase text-[10px]">TOTAL INVENTARIS</td>
                        <td className="border-2 border-black p-1 text-center">{(assets || []).length}</td>
                        <td colSpan="3" className="border-2 border-black p-1 text-[10px] italic">
                            {groupedAssets.length} jenis barang
                        </td>
                    </tr>
                </tfoot>
            </table>

            {/* Legend + Signature — keep together on same page */}
            <div style={{ breakInside: 'avoid' }}>
                <div className="mt-2 flex justify-between items-start text-[10px]">
                    <div className="italic">
                        Keterangan Kondisi:<br />
                        B : Baik | RR : Rusak Ringan | RB : Rusak Berat
                    </div>
                    <div className="text-right italic">
                        Dicetak pada: {today}
                    </div>
                </div>

                {/* Signature Area */}
                <div className="mt-6 grid grid-cols-2 text-center font-bold text-sm">
                    <div>
                        <p>Mengetahui,</p>
                        <p className="mb-16">Pengelola Aset</p>
                        <p className="underline">( ........................................ )</p>
                        <p className="text-xs font-normal">NIP/NIY: ............................</p>
                    </div>
                    <div>
                        <p>Padang, {today}</p>
                        <p className="mb-16">Penanggung Jawab Ruangan</p>
                        <p className="underline">( ........................................ )</p>
                        <p className="text-xs font-normal">NIP/NIY: ............................</p>
                    </div>
                </div>
            </div>
        </div>
    );
});

KIRPrint.displayName = 'KIRPrint';

export default KIRPrint;
