import { Plus, FileText, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Badge } from '../UIComponents';

export const VendorProjectTab = ({ projects, openModal }) => {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-800">Proyek Pengadaan & Seleksi Vendor</h2>
                <button onClick={() => openModal('project')} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-blue-500/20">
                    <Plus size={14} /> Buat Proyek
                </button>
            </div>

            {projects.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-slate-400">Belum ada data proyek pengadaan.</div>
            ) : (
                <div className="space-y-4">
                    {projects.map(project => (
                        <div key={project.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-slate-100 flex flex-wrap justify-between items-center bg-slate-50/50">
                                <div className="flex-1 pr-4">
                                    <h3 className="font-bold text-slate-800">{project.title} ({project.year})</h3>
                                    <p className="text-xs text-slate-500 mb-1">Total Target: {project.targetQuantity} pcs • Status: {project.status}</p>
                                    {project.projectItems && project.projectItems.length > 0 && (
                                        <div className="text-xs text-slate-600 bg-white px-2 py-1.5 rounded-lg border border-slate-200 inline-block">
                                            <span className="font-bold">Rincian Barang: </span>
                                            {project.projectItems.map(pi => `${pi.item?.name} (${pi.quantity})`).join(', ')}
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => openModal('project', project)} className="text-xs text-blue-600 font-bold hover:underline">Edit Proyek</button>
                                    <button onClick={() => openModal('vendor-selection', { projectId: project.id })} className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1">
                                        <Plus size={14} /> Tambah Vendor Seleksi
                                    </button>
                                </div>
                            </div>
                            <div className="p-4">
                                <h4 className="text-xs font-bold text-slate-600 uppercase mb-3">Daftar Vendor Peserta Seleksi</h4>
                                {(!project.selections || project.selections.length === 0) ? (
                                    <p className="text-sm text-slate-400">Belum ada vendor yang dimasukkan ke tahap seleksi.</p>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead className="text-xs text-slate-500 border-b border-slate-100">
                                            <tr>
                                                <th className="pb-2 text-left">Nama Vendor</th>
                                                <th className="pb-2 text-right">Harga Penawaran</th>
                                                <th className="pb-2 text-center">Proposal</th>
                                                <th className="pb-2 text-center">Status</th>
                                                <th className="pb-2 text-left">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {project.selections.map(sel => (
                                                <tr key={sel.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="py-2 font-medium text-slate-800">{sel.vendor?.name}</td>
                                                    <td className="py-2 text-right">Rp {sel.proposedPrice.toLocaleString('id-ID')}</td>
                                                    <td className="py-2 text-center">
                                                        {sel.proposalFileUrl ? (
                                                            <a href={sel.proposalFileUrl} download={`Proposal_${sel.vendor?.name}.pdf`} className="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs">
                                                                <FileText size={14} /> Unduh
                                                            </a>
                                                        ) : <span className="text-slate-400 text-xs">-</span>}
                                                    </td>
                                                    <td className="py-2 text-center">
                                                        <Badge color={sel.status === 'DIPILIH' ? 'green' : sel.status === 'DITOLAK' ? 'red' : 'yellow'}>{sel.status}</Badge>
                                                    </td>
                                                    <td className="py-2">
                                                        <button onClick={() => openModal('vendor-selection', sel)} className="text-xs text-blue-600 hover:underline">Evaluasi / Edit</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
