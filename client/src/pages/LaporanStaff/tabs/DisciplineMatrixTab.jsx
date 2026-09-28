import React from 'react';
import { Download } from 'lucide-react';
import dayjs from 'dayjs';

export default function DisciplineMatrixTab({
    matrixMonth,
    setMatrixMonth,
    handleExportExcelMatrix,
    matrixSummary = [],
    matrixDateRange = []
}) {
    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h3 className="text-base font-black text-slate-800">Matriks Rekapitulasi Kedisiplinan Staf</h3>
                    <p className="text-xs text-slate-400 font-medium">Status kehadiran laporan harian seluruh staf dalam satu bulan berjalan.</p>
                </div>
                <div className="flex items-center gap-3">
                    <input 
                        type="month" 
                        value={matrixMonth}
                        onChange={(e) => setMatrixMonth(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
                    />
                    <button
                        onClick={handleExportExcelMatrix}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                        <Download size={14} /> Ekspor Excel
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase border-b border-slate-100">
                                <th className="p-4 sticky left-0 bg-slate-50 z-10">Nama Staf</th>
                                <th className="p-4">Jabatan</th>
                                {matrixDateRange.map(d => (
                                    <th key={d} className="p-2 text-center min-w-[36px]">{dayjs(d).format('DD')}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                            {matrixSummary.map(st => (
                                <tr key={st.id} className="hover:bg-slate-50/60 transition-colors">
                                    <td className="p-4 font-bold text-slate-800 sticky left-0 bg-white z-10">{st.name}</td>
                                    <td className="p-4 text-slate-500">{st.position}</td>
                                    {matrixDateRange.map(d => {
                                        const stat = st.summaryByDate?.[d]?.status || 'BELUM';
                                        return (
                                            <td key={d} className="p-1 text-center">
                                                <span className={`inline-block w-6 h-6 rounded-lg text-[10px] font-bold leading-6 ${
                                                    stat === 'LENGKAP' ? 'bg-emerald-100 text-emerald-700' :
                                                    stat === 'PARSIAL' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-300'
                                                }`} title={`${st.name} (${d}): ${stat}`}>
                                                    {stat === 'LENGKAP' ? '✓' : stat === 'PARSIAL' ? '½' : '—'}
                                                </span>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
