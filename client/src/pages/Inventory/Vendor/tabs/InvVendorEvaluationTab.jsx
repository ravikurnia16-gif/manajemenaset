import { Plus, Star, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Badge } from '../UIComponents';

export const InvVendorEvaluationTab = ({ projects, openModal }) => {
    const allEvaluations = projects.flatMap(p => (p.evaluations || []).map(e => ({ ...e, project: p })));

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-800">Evaluasi & Penilaian Vendor</h2>
                <button onClick={() => openModal('vendor-evaluation')} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-blue-500/20">
                    <Plus size={14} /> Beri Penilaian
                </button>
            </div>

            {allEvaluations.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-slate-400">Belum ada data evaluasi.</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {allEvaluations.map(evalData => (
                        <div key={evalData.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="font-bold text-slate-800 text-base">{evalData.vendor?.name}</h3>
                                    <p className="text-xs text-slate-500 mt-0.5">Proyek: {evalData.project?.title}</p>
                                </div>
                                <div className="flex items-center gap-1 bg-yellow-50 text-yellow-700 px-2 py-1 rounded-lg">
                                    <Star size={14} className="fill-yellow-400 text-yellow-400" />
                                    <span className="font-bold text-sm">{evalData.rating.toFixed(1)}</span>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="bg-green-50/50 rounded-xl p-3 border border-green-100">
                                    <div className="flex items-center gap-1.5 text-green-700 font-medium text-xs mb-1">
                                        <CheckCircle2 size={14} /> Tepat Waktu
                                    </div>
                                    <div className="text-lg font-bold text-green-700">{evalData.onTimeRate}%</div>
                                </div>
                                <div className="bg-red-50/50 rounded-xl p-3 border border-red-100">
                                    <div className="flex items-center gap-1.5 text-red-700 font-medium text-xs mb-1">
                                        <AlertTriangle size={14} /> Reject / Cacat
                                    </div>
                                    <div className="text-lg font-bold text-red-700">{evalData.rejectRate}%</div>
                                </div>
                            </div>

                            <div className="flex-1 bg-slate-50 rounded-xl p-3 mb-4">
                                <p className="text-xs text-slate-500 font-medium mb-1">Catatan Evaluasi:</p>
                                <p className="text-sm text-slate-700 italic">{evalData.notes || "Tidak ada catatan."}</p>
                            </div>

                            <div className="flex justify-end">
                                <button onClick={() => openModal('vendor-evaluation', evalData)} className="text-xs text-blue-600 hover:underline">Edit Penilaian</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

