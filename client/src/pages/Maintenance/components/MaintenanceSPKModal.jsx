import React from 'react';
import { Printer, X } from 'lucide-react';

const urgencyLabels = {
    NORMAL: 'Biasa',
    URGENT: 'Penting',
    EMERGENCY: 'Darurat'
};

export default function MaintenanceSPKModal({
    show,
    onClose,
    report
}) {
    if (!show || !report) return null;

    const isPembangunan = report.targetDept === 'PEMBANGUNAN';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Modal Action Bar */}
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center no-print">
                    <div className="flex items-center gap-2">
                        <Printer size={18} className="text-blue-600" />
                        <h3 className="font-bold text-slate-800 text-sm">Pratinjau Surat Perintah Kerja (SPK)</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => window.print()}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                        >
                            <Printer size={14} /> Cetak / PDF
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-200 rounded-xl text-slate-500 transition-colors cursor-pointer"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Printable SPK Document Content */}
                <div className="p-8 overflow-y-auto print:p-0 print:overflow-visible text-slate-800 text-xs font-sans leading-relaxed space-y-5" id="printable-spk">
                    {/* Kop Surat Yayasan */}
                    <div className="text-center border-b-2 border-slate-800 pb-3">
                        <h2 className="text-base font-black uppercase tracking-wider text-slate-900">YAYASAN DAR EL-IMAN PADANG</h2>
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-700">
                            {isPembangunan ? 'BIDANG PEMBANGUNAN & PENGEMBANGAN' : 'BIDANG SARANA & PRASARANA'}
                        </h3>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                            Jl. Gunung Juaro RT.02 RW.04, Kel. Surau Gadang, Kec. Nanggalo, Kota Padang, Sumatera Barat
                        </p>
                    </div>

                    {/* Judul Dokumen */}
                    <div className="text-center space-y-1">
                        <h1 className="text-sm font-black uppercase tracking-wider underline">SURAT PERINTAH KERJA (SPK) PEMELIHARAAN</h1>
                        <p className="font-mono text-xs font-bold text-slate-700">Nomor: {report.code}</p>
                    </div>

                    {/* Detail Metadata Tabel */}
                    <div className="grid grid-cols-2 gap-4 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200 text-xs">
                        <div className="space-y-1.5">
                            <div className="flex"><span className="w-28 text-slate-500">Tanggal Terbit</span><span className="font-semibold">: {new Date(report.createdAt).toLocaleDateString('id-ID', { dateStyle: 'long' })}</span></div>
                            <div className="flex"><span className="w-28 text-slate-500">Unit Pemohon</span><span className="font-semibold">: {report.unit?.name || '-'}</span></div>
                            <div className="flex"><span className="w-28 text-slate-500">Nama Pelapor</span><span className="font-semibold">: {report.user?.name || report.user?.username || '-'}</span></div>
                            <div className="flex"><span className="w-28 text-slate-500">Kontak Pelapor</span><span className="font-semibold">: {report.user?.phone || '-'}</span></div>
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex"><span className="w-28 text-slate-500">Teknisi Pelaksana</span><span className="font-bold text-blue-700">: {report.technician || 'Belum Ditugaskan'}</span></div>
                            <div className="flex"><span className="w-28 text-slate-500">Tingkat Urgensi</span><span className="font-bold">: {urgencyLabels[report.urgency] || 'Biasa'}</span></div>
                            <div className="flex"><span className="w-28 text-slate-500">Kategori</span><span className="font-semibold">: {report.category === 'ROUTINE' ? 'Pemeliharaan Rutin' : 'Pemeliharaan Insidentil'}</span></div>
                            <div className="flex"><span className="w-28 text-slate-500">Lokasi Pekerjaan</span><span className="font-semibold">: {report.location || '-'}</span></div>
                        </div>
                    </div>

                    {/* Uraian Keluhan & Masalah */}
                    <div className="space-y-1.5">
                        <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 border-b pb-1">1. Uraian Keluhan / Masalah Pekerjaan</h4>
                        <div className="p-3 bg-white border border-slate-200 rounded-xl text-xs space-y-1">
                            <div className="font-bold text-slate-900">{report.title}</div>
                            <div className="text-slate-700 whitespace-pre-wrap">{report.description}</div>
                        </div>
                    </div>

                    {/* Tabel Aset Terkait (Jika Ada) */}
                    {report.assets && report.assets.length > 0 && (
                        <div className="space-y-1.5">
                            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 border-b pb-1">2. Daftar Aset Terkait</h4>
                            <table className="w-full border-collapse border border-slate-200 text-xs text-left">
                                <thead>
                                    <tr className="bg-slate-100 text-slate-700 font-bold">
                                        <th className="border border-slate-200 p-2 text-center w-8">No</th>
                                        <th className="border border-slate-200 p-2">Kode Aset</th>
                                        <th className="border border-slate-200 p-2">Nama Aset</th>
                                        <th className="border border-slate-200 p-2">Kondisi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.assets.map((a, i) => (
                                        <tr key={a.id}>
                                            <td className="border border-slate-200 p-2 text-center">{i + 1}</td>
                                            <td className="border border-slate-200 p-2 font-mono font-bold text-blue-600">{a.code}</td>
                                            <td className="border border-slate-200 p-2">{a.name}</td>
                                            <td className="border border-slate-200 p-2">{a.condition || 'BAIK'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Lembar Catatan Lapangan & Material Teknisi */}
                    <div className="space-y-1.5">
                        <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 border-b pb-1">
                            3. Lembar Tindakan Perbaikan & Penggunaan Bahan / Material (Diisi Teknisi)
                        </h4>
                        <div className="p-3 border border-slate-200 rounded-xl min-h-[90px] bg-slate-50/50 space-y-2">
                            {report.actionTaken ? (
                                <div className="font-mono text-[11px] text-slate-800 whitespace-pre-wrap">{report.actionTaken}</div>
                            ) : (
                                <div className="text-[10px] text-slate-400 italic">
                                    Catatan tindakan perbaikan di lapangan & rincian material yang digunakan:
                                    <div className="border-b border-dashed border-slate-300 mt-4 h-4"></div>
                                    <div className="border-b border-dashed border-slate-300 mt-4 h-4"></div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Rincian Biaya (Jika Tersedia) */}
                    {report.cost > 0 && (
                        <div className="space-y-1.5">
                            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 border-b pb-1">4. Realisasi Biaya</h4>
                            <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                                <span className="font-semibold text-slate-700">Total Pengeluaran / Biaya Perbaikan</span>
                                <span className="font-bold text-slate-900 text-sm">Rp {report.cost.toLocaleString('id-ID')}</span>
                            </div>
                        </div>
                    )}

                    {/* Lembar Tanda Tangan 3 Pihak */}
                    <div className="pt-6 grid grid-cols-3 text-center text-xs gap-4">
                        <div className="space-y-14">
                            <p className="font-semibold text-slate-600">Pemohon / Pelapor Unit,</p>
                            <p className="font-bold underline text-slate-900">
                                ({report.user?.name || report.user?.username || '...................................'})
                            </p>
                        </div>
                        <div className="space-y-14">
                            <p className="font-semibold text-slate-600">Teknisi Pelaksana,</p>
                            <p className="font-bold underline text-slate-900">
                                ({report.technician || '...................................'})
                            </p>
                        </div>
                        <div className="space-y-14">
                            <p className="font-semibold text-slate-600">
                                {isPembangunan ? 'Mengetahui, Kabid Pembangunan' : 'Mengetahui, Kabid Sarpras'}
                            </p>
                            <p className="font-bold underline text-slate-900">(...................................)</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
