import { Plus, FileSignature, Calendar } from 'lucide-react';
import { Badge } from '../../../ManajemenSeragam/UIComponents';

export const InvVendorMoUTab = ({ projects, openModal }) => {
    // Flatten all MOUs from all projects
    const allMous = projects.flatMap(p => (p.mous || []).map(m => ({ ...m, project: p })));

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-800">MoU & Kontrak Vendor</h2>
                <button onClick={() => openModal('vendor-mou')} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-blue-500/20">
                    <Plus size={14} /> Buat MoU Baru
                </button>
            </div>

            {allMous.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-slate-400">Belum ada MoU yang tercatat.</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {allMous.map(mou => (
                        <div key={mou.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-all">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                                        <FileSignature size={16} className="text-blue-500" /> {mou.vendor?.name}
                                    </h3>
                                    <p className="text-xs text-slate-500 font-mono mt-1">{mou.mouNumber}</p>
                                </div>
                                <Badge color={mou.status === 'SIGNED' ? 'green' : mou.status === 'EXPIRED' ? 'red' : 'yellow'}>{mou.status}</Badge>
                            </div>
                            
                            <div className="bg-slate-50 rounded-xl p-3 mb-4">
                                <p className="text-xs text-slate-600 font-medium mb-1">Terkait Proyek: {mou.project?.title}</p>
                                <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
                                    <span className="flex items-center gap-1"><Calendar size={12} /> Mulai: {new Date(mou.startDate).toLocaleDateString('id-ID')}</span>
                                    <span className="flex items-center gap-1"><Calendar size={12} /> Akhir: {new Date(mou.endDate).toLocaleDateString('id-ID')}</span>
                                </div>
                            </div>

                            <div className="flex justify-between items-center">
                                {mou.fileUrl ? (
                                    <a href={mou.fileUrl} download={`MoU_${mou.mouNumber}.pdf`} className="text-sm font-bold text-blue-600 hover:underline">Lihat Dokumen</a>
                                ) : (
                                    <span className="text-sm text-slate-400">Tidak ada file</span>
                                )}
                                <button onClick={() => openModal('vendor-mou', mou)} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg transition-colors">Edit MoU</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};





