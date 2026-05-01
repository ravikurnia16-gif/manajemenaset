import React, { forwardRef } from 'react';

const KIRPrint = forwardRef(({ room, unit, assets, settings }, ref) => {
    if (!room) return null;

    const today = new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    return (
        <div ref={ref} className="p-12 bg-white text-black font-serif print:p-8" style={{ minHeight: '297mm' }}>
            {/* Header */}
            <div className="flex flex-col items-center text-center border-b-2 border-black pb-4 mb-6">
                <h1 className="text-xl font-bold uppercase tracking-widest">{settings?.companyName || 'YAYASAN DAR EL-IMAN'}</h1>
                <h2 className="text-2xl font-black mt-1">KARTU INVENTARIS RUANGAN (KIR)</h2>
                <div className="w-full flex justify-between mt-4 text-sm font-bold">
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
                        <th className="border-2 border-black p-2 w-10">NO</th>
                        <th className="border-2 border-black p-2">NAMA BARANG / JENIS</th>
                        <th className="border-2 border-black p-2">MERK / MODEL / TYPE</th>
                        <th className="border-2 border-black p-2">KODE ASET</th>
                        <th className="border-2 border-black p-2 w-20">TAHUN</th>
                        <th className="border-2 border-black p-2 w-24">KONDISI</th>
                        <th className="border-2 border-black p-2">KETERANGAN</th>
                    </tr>
                </thead>
                <tbody>
                    {assets.length > 0 ? assets.map((asset, index) => (
                        <tr key={asset.id}>
                            <td className="border-2 border-black p-2 text-center">{index + 1}</td>
                            <td className="border-2 border-black p-2 font-bold">{asset.name}</td>
                            <td className="border-2 border-black p-2">{asset.brand || asset.spec || '-'}</td>
                            <td className="border-2 border-black p-2 font-mono">{asset.code}</td>
                            <td className="border-2 border-black p-2 text-center">
                                {asset.purchaseDate ? new Date(asset.purchaseDate).getFullYear() : '-'}
                            </td>
                            <td className="border-2 border-black p-2 text-center font-bold">
                                {asset.condition === 'BAIK' ? 'B' : asset.condition === 'RUSAK_RINGAN' ? 'RR' : 'RB'}
                            </td>
                            <td className="border-2 border-black p-2 text-xs italic">{asset.notes || '-'}</td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan="7" className="border-2 border-black p-8 text-center text-slate-400 italic">
                                Tidak ada data aset di ruangan ini
                            </td>
                        </tr>
                    )}
                    {/* Empty rows to fill space if needed */}
                    {assets.length < 15 && Array.from({ length: 15 - assets.length }).map((_, i) => (
                        <tr key={`empty-${i}`} className="h-8">
                            <td className="border-2 border-black p-2"></td>
                            <td className="border-2 border-black p-2"></td>
                            <td className="border-2 border-black p-2"></td>
                            <td className="border-2 border-black p-2"></td>
                            <td className="border-2 border-black p-2"></td>
                            <td className="border-2 border-black p-2"></td>
                            <td className="border-2 border-black p-2"></td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Legend and Footer */}
            <div className="mt-4 flex justify-between items-start text-[10px]">
                <div className="italic">
                    Keterangan Kondisi:<br />
                    B : Baik<br />
                    RR : Rusak Ringan<br />
                    RB : Rusak Berat
                </div>
                <div className="text-right italic">
                    Dicetak pada: {today}
                </div>
            </div>

            {/* Signature Area */}
            <div className="mt-12 grid grid-cols-2 text-center font-bold text-sm">
                <div>
                    <p>Mengetahui,</p>
                    <p className="mb-20">Pengelola Aset</p>
                    <p className="underline">( ........................................ )</p>
                    <p className="text-xs font-normal">NIP/NIY: ............................</p>
                </div>
                <div>
                    <p>Padang, {today}</p>
                    <p className="mb-20">Penanggung Jawab Ruangan</p>
                    <p className="underline">( ........................................ )</p>
                    <p className="text-xs font-normal">NIP/NIY: ............................</p>
                </div>
            </div>
        </div>
    );
});

KIRPrint.displayName = 'KIRPrint';

export default KIRPrint;
