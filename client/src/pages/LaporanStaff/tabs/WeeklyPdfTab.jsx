import React from 'react';
import { Printer, Camera } from 'lucide-react';
import dayjs from 'dayjs';
import { getMediaUrl } from '../../../lib/media';

export default function WeeklyPdfTab({
    weeklyStartDate,
    setWeeklyStartDate,
    weeklyEndDate,
    setWeeklyEndDate,
    customKabidNiy,
    setCustomKabidNiy,
    weeklyData,
    user,
    setLightboxPhoto
}) {
    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Control Bar */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
                <div>
                    <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                        <Printer className="text-indigo-600" size={20} /> Generator Laporan Mingguan Kepala Bidang Sarana
                    </h3>
                    <p className="text-xs text-slate-400 font-medium">Format resmi siap cetak / simpan PDF untuk laporan ke Pimpinan Yayasan.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
                        <span>Dari:</span>
                        <input type="date" value={weeklyStartDate} onChange={(e) => setWeeklyStartDate(e.target.value)} className="bg-transparent outline-none cursor-pointer" />
                        <span>Sampai:</span>
                        <input type="date" value={weeklyEndDate} onChange={(e) => setWeeklyEndDate(e.target.value)} className="bg-transparent outline-none cursor-pointer" />
                    </div>
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
                        <span>NIY:</span>
                        <input 
                            type="text" 
                            value={customKabidNiy} 
                            onChange={(e) => setCustomKabidNiy(e.target.value)} 
                            placeholder="NIY Kepala..." 
                            className="w-28 bg-white px-2 py-0.5 rounded border border-slate-200 font-mono text-xs outline-none" 
                            title="Nomor Induk Yayasan (NIY) Kepala Bidang Sarana"
                        />
                    </div>
                    <button
                        onClick={() => window.print()}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20 cursor-pointer"
                    >
                        <Printer size={16} /> Cetak / Unduh PDF
                    </button>
                </div>
            </div>

            {/* PRINTABLE DOCUMENT CONTAINER */}
            <div className="bg-white p-8 md:p-12 rounded-3xl border border-slate-200 shadow-sm space-y-8 max-w-4xl mx-auto text-slate-800 print:border-none print:shadow-none print:p-0">
                {/* KOP SURAT YAYASAN */}
                <div className="text-center border-b-2 border-slate-800 pb-4 space-y-1">
                    <h2 className="text-xl font-black tracking-wider text-slate-900 uppercase">YAYASAN PONDOK PESANTREN ISLAM AL-MUKMIN NGKRUKI</h2>
                    <h3 className="text-base font-black text-indigo-950 uppercase tracking-widest">BIDANG SARANA & PRASARANA</h3>
                    <p className="text-[11px] text-slate-600">Ngruki, Cemani, Grogol, Sukoharjo, Jawa Tengah</p>
                </div>

                {/* TITLE */}
                <div className="text-center space-y-1">
                    <h4 className="text-sm font-black uppercase tracking-wider underline">LAPORAN KINERJA & AKTIVITAS MINGGUAN</h4>
                    <p className="text-xs font-bold text-slate-600">Periode: {weeklyData?.period?.formattedPeriod || `${weeklyStartDate} s/d ${weeklyEndDate}`}</p>
                </div>

                {/* I. EXECUTIVE SUMMARY */}
                <div className="space-y-2">
                    <h5 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">I. Ringkasan Eksekutif Kinerja</h5>
                    <div className="grid grid-cols-3 gap-3 text-center pt-2">
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                            <span className="text-[10px] font-bold text-slate-500 block uppercase">Pekerjaan Selesai</span>
                            <span className="text-xl font-black text-emerald-700">{weeklyData?.stats?.totalCompleted || 0}</span>
                        </div>
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                            <span className="text-[10px] font-bold text-slate-500 block uppercase">Dalam Proses</span>
                            <span className="text-xl font-black text-amber-700">{weeklyData?.stats?.totalInProgress || 0}</span>
                        </div>
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                            <span className="text-[10px] font-bold text-slate-500 block uppercase">Kendala Ditangani</span>
                            <span className="text-xl font-black text-rose-700">{weeklyData?.stats?.totalObstacles || 0}</span>
                        </div>
                    </div>
                </div>

                {/* II. RINCIAN AKTIVITAS PER HARI */}
                <div className="space-y-4">
                    <h5 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">II. Rincian Aktivitas Harian Staf Bidang Sarana</h5>
                    {weeklyData?.dailyDivisionBreakdown?.map((dayObj, dIdx) => (
                        <div key={dIdx} className="space-y-2">
                            <h6 className="text-xs font-bold text-indigo-900 bg-slate-100 px-3 py-1.5 rounded-lg">{dayObj.date} ({dayObj.totalActivities} kegiatan)</h6>
                            {dayObj.activities.length === 0 ? (
                                <p className="text-[11px] text-slate-400 italic pl-3">- Tidak ada aktivitas tercatat -</p>
                            ) : (
                                <ul className="list-disc pl-6 space-y-1 text-xs leading-relaxed">
                                    {dayObj.activities.map((act, aIdx) => (
                                        <li key={aIdx}>
                                            <b>[{act.categoryTag}] {act.staffName} ({act.position}):</b> {act.activity}
                                            {act.obstacleNote && <span className="text-rose-600 font-bold"> (Kendala: {act.obstacleNote})</span>}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ))}
                </div>

                {/* III. REKAP KENDALA */}
                {weeklyData?.obstacleList && weeklyData.obstacleList.length > 0 && (
                    <div className="space-y-2">
                        <h5 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">III. Rekap Kendala / Hambatan Lapangan</h5>
                        <table className="w-full text-xs text-left border border-slate-200">
                            <thead className="bg-slate-50 font-bold border-b border-slate-200">
                                <tr>
                                    <th className="p-2 border-r">Tgl</th>
                                    <th className="p-2 border-r">Staf</th>
                                    <th className="p-2 border-r">Pekerjaan</th>
                                    <th className="p-2">Uraian Kendala</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {weeklyData.obstacleList.map((obs, idx) => (
                                    <tr key={idx}>
                                        <td className="p-2 border-r">{obs.date}</td>
                                        <td className="p-2 border-r font-bold">{obs.staffName}</td>
                                        <td className="p-2 border-r">{obs.activity}</td>
                                        <td className="p-2 text-rose-700 font-medium">{obs.obstacleNote}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* SIGNATURE BLOCK */}
                <div className="pt-8 flex justify-end">
                    <div className="text-center space-y-16">
                        <div>
                            <p className="text-xs font-medium">Sukoharjo, {dayjs().format('DD MMMM YYYY')}</p>
                            <p className="text-xs font-bold uppercase mt-1">Kepala Bidang Sarana & Prasarana</p>
                        </div>
                        <div className="space-y-0.5">
                            <p className="text-xs font-bold underline">{weeklyData?.kabid?.name || user?.name || 'Ravi Kurnia'}</p>
                            <p className="text-[10px] text-slate-600 font-mono">
                                NIY. {customKabidNiy || weeklyData?.kabid?.niy || user?.nip || user?.username || ''}
                            </p>
                        </div>
                    </div>
                </div>

                {/* ============================================================== */}
                {/* HALAMAN LAMPIRAN DOKUMENTASI FOTO KEGIATAN */}
                {/* ============================================================== */}
                <div className="pt-10 mt-10 border-t-2 border-dashed border-slate-300 print:border-none print:pt-0 print:mt-0" style={{ pageBreakBefore: 'always', breakBefore: 'page' }}>
                    {/* KOP LAMPIRAN */}
                    <div className="text-center border-b-2 border-slate-800 pb-3 space-y-1">
                        <h3 className="text-[10px] font-black tracking-widest text-slate-500 uppercase">LAMPIRAN DOKUMENTASI LAPANGAN</h3>
                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                            FOTO BUKTI AKTIVITAS HARIAN STAF BIDANG SARANA
                        </h4>
                        <p className="text-xs font-bold text-slate-600">
                            Periode: {weeklyData?.period?.formattedPeriod || `${weeklyStartDate} s/d ${weeklyEndDate}`}
                        </p>
                    </div>

                    {/* DAFTAR FOTO DOKUMENTASI */}
                    {weeklyData?.documentationPhotos && weeklyData.documentationPhotos.length > 0 ? (
                        <div className="pt-6 space-y-4">
                            <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-100">
                                <span className="font-bold">Total Foto Terlampir: {weeklyData.documentationPhotos.length} Foto Dokumentasi</span>
                                <span className="text-[10px] text-slate-400 italic">*Foto diunggah langsung oleh staf sarana saat pelaporan harian</span>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {weeklyData.documentationPhotos.map((doc, pIdx) => (
                                    <div key={pIdx} className="bg-slate-50 border border-slate-200 rounded-2xl p-2.5 space-y-2 flex flex-col justify-between break-inside-avoid shadow-2xs">
                                        <div className="w-full h-44 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center">
                                            <img 
                                                src={getMediaUrl(doc.photoUrl)} 
                                                alt={doc.activity} 
                                                className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform" 
                                                onClick={() => setLightboxPhoto(getMediaUrl(doc.photoUrl))}
                                                onError={(e) => {
                                                    e.target.onerror = null;
                                                    e.target.src = 'https://placehold.co/400x300?text=Foto+Dokumentasi';
                                                }}
                                            />
                                        </div>
                                        <div className="space-y-1 text-left">
                                            <div className="flex items-center justify-between gap-1">
                                                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                                                    {doc.dateShort}
                                                </span>
                                                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-200/60 text-slate-600">
                                                    {doc.categoryTag}
                                                </span>
                                            </div>
                                            <p className="text-xs font-black text-slate-800 line-clamp-1">
                                                {doc.staffName} <span className="text-[10px] font-normal text-slate-500">({doc.position})</span>
                                            </p>
                                            <p className="text-[11px] text-slate-600 font-medium line-clamp-2 leading-tight">
                                                {doc.activity}
                                            </p>
                                            {doc.obstacleNote && (
                                                <p className="text-[10px] text-rose-600 font-bold bg-rose-50 p-1 rounded">
                                                    ⚠️ {doc.obstacleNote}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="pt-12 pb-12 text-center text-slate-400 space-y-2">
                            <Camera size={36} className="mx-auto text-slate-300" />
                            <p className="text-xs italic">Tidak ada lampiran foto dokumentasi lapangan pada rentang tanggal ini.</p>
                        </div>
                    )}

                    {/* Catatan Kaki Lampiran */}
                    <div className="pt-8 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-400 mt-6">
                        <span>Sistem Informasi Manajemen Aset & Sarpras Yayasan Pondok Pesantren Islam Al-Mukmin Ngruki</span>
                        <span>Halaman Lampiran Dokumentasi Foto Kegiatan Lapangan</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
