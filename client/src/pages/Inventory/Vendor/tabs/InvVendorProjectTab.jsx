import { Plus, FileText, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Badge } from '../../../ManajemenSeragam/UIComponents';

export const InvVendorProjectTab = ({ projects, openModal }) => {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Proyek Pengadaan Logistik & Seleksi Vendor</h2>
                    <p className="text-xs text-slate-500">Kelola pengadaan barang logistik terencana dan tender vendor</p>
                </div>
                <button onClick={() => openModal('project')} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-blue-500/20 transition-all">
                    <Plus size={14} /> Buat Proyek Baru
                </button>
            </div>

            {projects.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-slate-400">Belum ada data proyek pengadaan logistik.</div>
            ) : (
                <div className="space-y-4">
                    {projects.map(project => (
                        <div key={project.id} className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
                            <div className="p-4 border-b border-slate-100 flex flex-wrap justify-between items-start gap-3 bg-slate-50/60">
                                <div className="flex-1 min-w-[280px]">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-bold text-slate-800 text-base">{project.title || project.name}</h3>
                                        <span className="text-xs bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-full">{project.year}</span>
                                        <Badge color={project.status === 'SELESAI' ? 'green' : project.status === 'BERJALAN' ? 'blue' : project.status === 'SELEKSI' ? 'purple' : 'yellow'}>
                                            {project.status}
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-slate-500 mb-2">
                                        Total Target: <span className="font-bold text-slate-700">{project.targetQuantity || 0} item</span>
                                        {project.budget > 0 && <span> • Anggaran: <span className="font-bold text-emerald-600">Rp {project.budget.toLocaleString('id-ID')}</span></span>}
                                        <span> • Tipe: <span className="font-medium text-slate-600">{project.type || 'SELEKSI'}</span></span>
                                    </p>
                                    
                                    {project.projectItems && project.projectItems.length > 0 && (
                                        <div className="text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200 inline-flex flex-wrap items-center gap-1.5 shadow-2xs">
                                            <span className="font-bold text-slate-700">Rincian Barang: </span>
                                            {project.projectItems.map(pi => (
                                                <span key={pi.id || pi.itemId} className="bg-slate-100 px-2 py-0.5 rounded-md text-[11px] font-medium text-slate-700">
                                                    {pi.item?.name || 'Barang'} <b className="text-blue-600">({pi.quantity} {pi.item?.unit || 'Pcs'})</b>
                                                    {pi.receivedQuantity > 0 && <span className="text-green-600 ml-1">✓ {pi.receivedQuantity}</span>}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {project.status !== 'SELESAI' && (
                                        <button onClick={() => openModal('project-receive', project)} className="bg-emerald-600 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-700 shadow-xs transition-colors">
                                            <CheckCircle size={14} /> Terima Barang & Selesai
                                        </button>
                                    )}
                                    <button onClick={() => openModal('project', project)} className="text-xs text-blue-600 font-bold hover:underline px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors">Edit Proyek</button>
                                    <button onClick={() => openModal('vendor-selection', { projectId: project.id })} className="bg-blue-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-blue-700 shadow-xs transition-colors">
                                        <Plus size={14} /> Tambah Vendor Seleksi
                                    </button>
                                </div>
                            </div>
                            <div className="p-4">
                                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">Daftar Vendor Peserta Seleksi</h4>
                                {(!project.selections || project.selections.length === 0) ? (
                                    <p className="text-xs text-slate-400 italic">Belum ada vendor yang dimasukkan ke tahap seleksi proyek ini.</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead className="text-slate-500 border-b border-slate-100 font-bold">
                                                <tr>
                                                    <th className="pb-2 text-left">Nama Vendor</th>
                                                    <th className="pb-2 text-right">Harga Penawaran</th>
                                                    <th className="pb-2 text-center">Proposal</th>
                                                    <th className="pb-2 text-center">Status</th>
                                                    <th className="pb-2 text-center">Aksi</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {project.selections.map(sel => (
                                                    <tr key={sel.id} className="hover:bg-slate-50 transition-colors">
                                                        <td className="py-2.5 font-bold text-slate-800">{sel.vendor?.name}</td>
                                                        <td className="py-2.5 text-right font-medium text-slate-700">Rp {Number(sel.proposedPrice || 0).toLocaleString('id-ID')}</td>
                                                        <td className="py-2.5 text-center">
                                                            {sel.proposalFileUrl ? (
                                                                <a href={sel.proposalFileUrl} download={`Proposal_${sel.vendor?.name}.pdf`} className="inline-flex items-center gap-1 text-blue-600 font-medium hover:underline text-xs">
                                                                    <FileText size={13} /> Unduh
                                                                </a>
                                                            ) : <span className="text-slate-400 text-xs">-</span>}
                                                        </td>
                                                        <td className="py-2.5 text-center">
                                                            <Badge color={sel.status === 'DIPILIH' ? 'green' : sel.status === 'DITOLAK' ? 'red' : 'yellow'}>{sel.status}</Badge>
                                                        </td>
                                                        <td className="py-2.5 text-center">
                                                            <button onClick={() => openModal('vendor-selection', sel)} className="text-xs text-blue-600 font-medium hover:underline">Evaluasi / Edit</button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};





