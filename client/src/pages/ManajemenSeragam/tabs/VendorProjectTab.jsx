import React, { useState } from 'react';
import { 
    Plus, 
    FileText, 
    CheckCircle, 
    XCircle, 
    Clock, 
    ShieldCheck, 
    PackageCheck, 
    Calendar, 
    User, 
    Lock,
    FileSpreadsheet
} from 'lucide-react';
import { Badge } from '../UIComponents';

export const VendorProjectTab = ({ projects = [], openModal }) => {
    const [filterStatus, setFilterStatus] = useState('ALL');

    const counts = {
        ALL: projects.length,
        PENDING: projects.filter(p => p.status === 'MENUNGGU_PERSETUJUAN' || p.approvalStatus === 'PENDING').length,
        APPROVED: projects.filter(p => p.status === 'DISETUJUI' || p.approvalStatus === 'APPROVED').length,
        BERJALAN: projects.filter(p => p.status === 'BERJALAN').length,
        SELESAI: projects.filter(p => p.status === 'SELESAI').length
    };

    const filteredProjects = projects.filter(p => {
        if (filterStatus === 'PENDING') return p.status === 'MENUNGGU_PERSETUJUAN' || p.approvalStatus === 'PENDING';
        if (filterStatus === 'APPROVED') return p.status === 'DISETUJUI' || (p.approvalStatus === 'APPROVED' && p.status !== 'BERJALAN' && p.status !== 'SELESAI');
        if (filterStatus === 'BERJALAN') return p.status === 'BERJALAN';
        if (filterStatus === 'SELESAI') return p.status === 'SELESAI';
        return true;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-4">
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Proyek Pengadaan Seragam & Seleksi Penjahit</h2>
                    <p className="text-xs text-slate-500">
                        Alur terpadu: Pengajuan &rarr; Persetujuan Kabid Sarana (ACC) &rarr; Surat Pesanan (PO) &rarr; Cek Fisik Jahitan & BAST E-Office
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => openModal('project-import')} 
                        className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all hover:border-indigo-300"
                    >
                        <FileSpreadsheet size={15} className="text-emerald-600" /> Import Proyek (Excel)
                    </button>
                    <button 
                        onClick={() => openModal('project')} 
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-blue-500/20 transition-all"
                    >
                        <Plus size={14} /> Buat Proyek Baru
                    </button>
                </div>
            </div>

            {/* Filter Tabs / Pills */}
            <div className="flex flex-wrap gap-2 pt-1 border-b border-slate-200 pb-3">
                <button
                    type="button"
                    onClick={() => setFilterStatus('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${filterStatus === 'ALL' ? 'bg-slate-800 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                    Semua Proyek <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-700/50 text-white">{counts.ALL}</span>
                </button>
                <button
                    type="button"
                    onClick={() => setFilterStatus('PENDING')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${filterStatus === 'PENDING' ? 'bg-amber-600 text-white shadow-xs' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}
                >
                    <Clock size={13} /> Menunggu ACC Kabid <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-700 text-white">{counts.PENDING}</span>
                </button>
                <button
                    type="button"
                    onClick={() => setFilterStatus('APPROVED')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${filterStatus === 'APPROVED' ? 'bg-blue-600 text-white shadow-xs' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
                >
                    <CheckCircle size={13} /> Disetujui (ACC) <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-700 text-white">{counts.APPROVED}</span>
                </button>
                <button
                    type="button"
                    onClick={() => setFilterStatus('BERJALAN')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${filterStatus === 'BERJALAN' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}
                >
                    <FileText size={13} /> Berjalan (PO) <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-700 text-white">{counts.BERJALAN}</span>
                </button>
                <button
                    type="button"
                    onClick={() => setFilterStatus('SELESAI')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${filterStatus === 'SELESAI' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
                >
                    <PackageCheck size={13} /> Selesai (BAST) <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-700 text-white">{counts.SELESAI}</span>
                </button>
            </div>

            {filteredProjects.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-slate-400">
                    Belum ada data proyek seragam pada filter ini.
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredProjects.map(project => {
                        const isPendingApproval = project.status === 'MENUNGGU_PERSETUJUAN' || project.approvalStatus === 'PENDING';
                        const isApproved = project.approvalStatus === 'APPROVED' || project.status === 'DISETUJUI' || project.status === 'BERJALAN' || project.status === 'SELESAI';
                        const isRejected = project.status === 'DITOLAK' || project.approvalStatus === 'REJECTED';

                        return (
                            <div key={project.id} className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden transition-all hover:border-blue-200">
                                <div className="p-4 border-b border-slate-100 flex flex-wrap justify-between items-start gap-3 bg-slate-50/70">
                                    <div className="flex-1 min-w-[280px]">
                                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                            <h3 className="font-bold text-slate-800 text-base">{project.title}</h3>
                                            <span className="text-xs bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-full">{project.year}</span>

                                            {/* Badges */}
                                            {isPendingApproval && (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                                                    <Clock size={12} /> Menunggu ACC Kabid
                                                </span>
                                            )}
                                            {project.status === 'DISETUJUI' && (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                                                    <CheckCircle size={12} /> Disetujui (ACC)
                                                </span>
                                            )}
                                            {isRejected && (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                                                    <XCircle size={12} /> Ditolak
                                                </span>
                                            )}
                                            {project.status === 'BERJALAN' && (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                                                    <FileText size={12} /> Berjalan (PO)
                                                </span>
                                            )}
                                            {project.status === 'SELESAI' && (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                    <PackageCheck size={12} /> Selesai (BAST)
                                                </span>
                                            )}
                                        </div>

                                        {/* Metadata */}
                                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mb-2">
                                            <span className="flex items-center gap-1">
                                                <User size={12} className="text-slate-400" />
                                                Pemohon: <b className="text-slate-700">{project.requestedByName || 'Pengelola Seragam'}</b>
                                            </span>
                                            {project.targetDate && (
                                                <span className="flex items-center gap-1">
                                                    <Calendar size={12} className="text-slate-400" />
                                                    Target: <b className="text-slate-700">{new Date(project.targetDate).toLocaleDateString('id-ID')}</b>
                                                </span>
                                            )}
                                            {project.budget > 0 && (
                                                <span>Pagu: <b className="text-emerald-600">Rp {Number(project.budget).toLocaleString('id-ID')}</b></span>
                                            )}
                                            <span>Target: <b className="text-blue-700">{project.targetQuantity} pcs</b></span>
                                        </div>

                                        {/* Urgensi note jika ada */}
                                        {project.justification && (
                                            <p className="text-[11px] text-slate-600 italic bg-white px-2.5 py-1 rounded-lg border border-slate-200 inline-block mb-2 max-w-2xl">
                                                "Urgensi: {project.justification}"
                                            </p>
                                        )}

                                        {/* Document Numbers */}
                                        {(project.poNumber || project.bastNumber) && (
                                            <div className="flex flex-wrap items-center gap-2 mb-2">
                                                {project.poNumber && (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md">
                                                        PO: {project.poNumber}
                                                    </span>
                                                )}
                                                {project.bastNumber && (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md">
                                                        BAST: {project.bastNumber}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {/* Rincian Barang */}
                                        {project.projectItems && project.projectItems.length > 0 && (
                                            <div className="text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200 inline-flex flex-wrap items-center gap-1.5 shadow-2xs">
                                                <span className="font-bold text-slate-700">Rincian Barang: </span>
                                                {project.projectItems.map(pi => {
                                                    const adj = (project.itemAdjustments || []).find(a => a.variantId === pi.variantId);
                                                    return (
                                                        <span key={pi.id || pi.variantId} className="bg-slate-100 px-2 py-0.5 rounded-md text-[11px] font-medium text-slate-700">
                                                            {pi.variant?.item?.name || 'Seragam'} - {pi.variant?.sizeName || '?'} <b className="text-blue-600">({pi.quantity})</b>
                                                            {adj && (
                                                                <span className="text-[10px] text-amber-700 font-bold ml-1 bg-amber-50 px-1 py-0.2 rounded border border-amber-200" title={`Disetujui ${pi.quantity} dari semula ${adj.originalQuantity}`}>
                                                                    ACC: {pi.quantity}/{adj.originalQuantity}
                                                                </span>
                                                            )}
                                                            {pi.receivedQuantity > 0 && <span className="text-emerald-600 font-bold ml-1">✓ {pi.receivedQuantity}</span>}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Buttons Column */}
                                    <div className="flex flex-wrap gap-2 items-center">
                                        {/* 1. Lembar Persetujuan (ACC Kabid) */}
                                        <button 
                                            onClick={() => openModal('project-approval', project)} 
                                            className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 shadow-2xs transition-colors"
                                        >
                                            <ShieldCheck size={14} className="text-blue-600" />
                                            Lembar Persetujuan
                                        </button>

                                        {/* 2. Surat Pesanan (PO) - Enabled setelah ACC */}
                                        {isApproved ? (
                                            <button 
                                                onClick={() => openModal('project-po', project)} 
                                                className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-2xs transition-colors"
                                            >
                                                <FileText size={14} className="text-indigo-600" />
                                                {project.poNumber ? 'Lihat / Cetak PO' : 'Terbitkan PO'}
                                            </button>
                                        ) : (
                                            <button 
                                                disabled 
                                                title="Surat Pesanan baru dapat diterbitkan setelah disetujui Kepala Bidang Sarana"
                                                className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                                            >
                                                <Lock size={12} /> PO (Terkunci)
                                            </button>
                                        )}

                                        {/* 3. Penerimaan Barang & BAST */}
                                        {isApproved && project.status !== 'SELESAI' && (
                                            <button 
                                                onClick={() => openModal('project-receive', project)} 
                                                className="bg-emerald-600 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-700 shadow-xs transition-colors"
                                            >
                                                <CheckCircle size={14} /> Terima Seragam & BAST
                                            </button>
                                        )}

                                        {/* 4. Lihat BAST */}
                                        {project.bastNumber && (
                                            <button 
                                                onClick={() => openModal('project-bast', project)} 
                                                className="bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
                                            >
                                                <PackageCheck size={14} className="text-emerald-600" />
                                                Cetak BAST
                                            </button>
                                        )}

                                        {/* Edit Proyek */}
                                        <button 
                                            onClick={() => openModal('project', project)} 
                                            className="text-xs text-slate-600 font-bold hover:bg-slate-100 px-2.5 py-1.5 rounded-xl transition-colors"
                                        >
                                            Edit
                                        </button>

                                        {/* Tambah Vendor Seleksi */}
                                        {isApproved ? (
                                            <button 
                                                onClick={() => openModal('vendor-selection', { projectId: project.id })} 
                                                className="bg-slate-800 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-slate-900 shadow-xs transition-colors"
                                            >
                                                <Plus size={13} /> Tambah Vendor
                                            </button>
                                        ) : (
                                            <button 
                                                disabled 
                                                title="Penjahit/Vendor dapat ditambahkan setelah proyek disetujui Kepala Bidang Sarana"
                                                className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed flex items-center gap-1"
                                            >
                                                <Lock size={12} /> Seleksi Vendor
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Daftar Peserta Seleksi */}
                                <div className="p-4">
                                    <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">
                                        Daftar Vendor / Penjahit Peserta Seleksi
                                    </h4>
                                    {(!project.selections || project.selections.length === 0) ? (
                                        <p className="text-xs text-slate-400 italic">
                                            {isPendingApproval ? 'Proyek sedang menunggu persetujuan Kepala Bidang Sarana sebelum penunjukan/tender vendor.' : 'Belum ada vendor/penjahit yang dimasukkan ke tahap seleksi.'}
                                        </p>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs">
                                                <thead className="text-slate-500 border-b border-slate-100 font-bold">
                                                    <tr>
                                                        <th className="pb-2 text-left">Nama Vendor / Penjahit</th>
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
                        );
                    })}
                </div>
            )}
        </div>
    );
};
