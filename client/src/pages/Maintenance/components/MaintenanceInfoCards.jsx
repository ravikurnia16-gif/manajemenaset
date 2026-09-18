import React from 'react';
import { PhoneCall, Wrench, Clock, CheckCircle2 } from 'lucide-react';

const urgencyLabels = {
    NORMAL: 'Biasa',
    URGENT: 'Penting',
    EMERGENCY: 'Darurat'
};

const urgencyColors = {
    NORMAL: 'text-slate-500 bg-slate-100',
    URGENT: 'text-amber-700 bg-amber-100',
    EMERGENCY: 'text-red-700 bg-red-100'
};

export default function MaintenanceInfoCards({
    report,
    onOpenSingleAssetModal,
    onFetchAssetHistory
}) {
    const isMultiAsset = report.assets && report.assets.length > 1;
    const completedAssets = Array.isArray(report.aiDiagnosis?.completedAssets) ? report.aiDiagnosis.completedAssets : [];
    const completedCount = isMultiAsset ? report.assets.filter(a => completedAssets.includes(a.id)).length : 0;
    const progressPercent = isMultiAsset ? Math.round((completedCount / report.assets.length) * 100) : 0;
    const canCompleteAction = report.status === 'IN_PROGRESS' || report.status === 'ASSIGNED';

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Kartu Informasi Laporan & Aset */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-xs">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
                    Informasi Laporan
                </h3>
                <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between">
                        <span className="text-slate-500">Judul</span>
                        <span className="font-bold text-slate-800 text-right">{report.title}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500">Bidang Tujuan</span>
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            report.targetDept === 'PEMBANGUNAN' 
                                ? 'bg-orange-50 text-orange-600 border border-orange-100' 
                                : 'bg-blue-50 text-blue-600 border border-blue-100'
                        }`}>
                            {report.targetDept === 'PEMBANGUNAN' ? 'Pembangunan' : 'Sarana & Prasarana'}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500">Urgensi</span>
                        {report.urgency && report.urgency !== 'NORMAL' ? (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${urgencyColors[report.urgency]}`}>
                                {urgencyLabels[report.urgency]}
                            </span>
                        ) : (
                            <span className="font-semibold text-slate-600">Biasa</span>
                        )}
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Tipe</span>
                        <span className={`font-semibold ${report.type === 'ASSET' ? 'text-purple-600' : 'text-gray-600'}`}>
                            {report.type === 'ASSET' ? 'Aset Terdata' : 'Non-Aset'}
                        </span>
                    </div>

                    {/* Multi-Asset Section */}
                    {report.assets && report.assets.length > 0 && (
                        <div className="space-y-2 pt-1 border-t border-slate-100 mt-2">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-600 font-bold">
                                    Aset Terkait ({report.assets.length} Unit):
                                </span>
                                {isMultiAsset && (
                                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                        {completedCount}/{report.assets.length} Selesai ({progressPercent}%)
                                    </span>
                                )}
                            </div>

                            {/* Mini Progress Bar for Multi-Asset */}
                            {isMultiAsset && (
                                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                    <div 
                                        className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                                        style={{ width: `${progressPercent}%` }}
                                    />
                                </div>
                            )}

                            <div className="space-y-2 mt-1 max-h-72 overflow-y-auto pr-1">
                                {report.assets.map(a => {
                                    const isAssetCompleted = completedAssets.includes(a.id);
                                    const specificAction = (report.aiDiagnosis?.assetActions || []).find(act => parseInt(act.assetId) === a.id);

                                    return (
                                        <div key={a.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 font-mono text-xs space-y-1.5">
                                            <div className="flex justify-between items-center flex-wrap gap-2">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-bold text-blue-600">{a.code}</span>
                                                    <span className="text-slate-700 font-sans font-medium">{a.name}</span>
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-sans ${
                                                        a.condition === 'BAIK' 
                                                            ? 'bg-green-100 text-green-800 border border-green-200' 
                                                            : a.condition === 'RUSAK_RINGAN' 
                                                                ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                                                                : 'bg-red-100 text-red-800 border border-red-200'
                                                    }`}>
                                                        {a.condition || 'BAIK'}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-1.5 font-sans">
                                                    {isAssetCompleted ? (
                                                        <span className="flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-50 px-2 py-1 rounded-lg border border-green-200">
                                                            <CheckCircle2 size={12} /> Selesai
                                                        </span>
                                                    ) : (
                                                        canCompleteAction && (
                                                            <button 
                                                                onClick={() => onOpenSingleAssetModal(a)}
                                                                className="flex items-center gap-1 px-2.5 py-1 bg-white border border-green-200 rounded-lg text-green-700 font-semibold hover:bg-green-50 transition-colors shadow-2xs"
                                                                title="Catat Tindakan Khusus Aset & Tandai Selesai"
                                                            >
                                                                <Wrench size={12} />
                                                                <span>Tindakan</span>
                                                            </button>
                                                        )
                                                    )}
                                                    <button 
                                                        onClick={() => onFetchAssetHistory(a)}
                                                        className="flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 rounded-lg text-blue-600 font-semibold hover:bg-blue-50 transition-colors shadow-2xs"
                                                        title="Lihat Riwayat Perbaikan"
                                                    >
                                                        <Clock size={12} />
                                                        <span>Riwayat</span>
                                                    </button>
                                                </div>
                                            </div>

                                            {specificAction?.actionTaken && (
                                                <div className="bg-white/90 p-2 rounded-lg border border-slate-200 font-sans text-[11px] text-slate-700 flex items-start gap-1.5">
                                                    <Wrench size={13} className="text-blue-500 shrink-0 mt-0.5" />
                                                    <div className="min-w-0">
                                                        <span className="font-bold text-slate-800">Tindakan: </span>
                                                        <span>{specificAction.actionTaken}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {report.location && (
                        <div className="flex justify-between">
                            <span className="text-slate-500">Lokasi</span>
                            <span className="font-medium text-slate-700">{report.location}</span>
                        </div>
                    )}
                    <div className="flex justify-between">
                        <span className="text-slate-500">Tanggal Pengajuan</span>
                        <span className="font-medium text-slate-700">
                            {new Date(report.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                    </div>
                </div>
            </div>

            {/* Kartu Pelapor & Penanganan */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-xs">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
                    Pelapor & Penanganan
                </h3>
                <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500">Pelapor</span>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800">{report.user?.name || report.user?.username}</span>
                            {report.user?.phone && (
                                <a
                                    href={`https://wa.me/${report.user.phone.replace(/^0/, '62')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 p-1 rounded-md transition-colors"
                                    title={`Chat WhatsApp (${report.user.phone})`}
                                >
                                    <PhoneCall size={12} />
                                </a>
                            )}
                        </div>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Unit Pemohon</span>
                        <span className="font-semibold text-slate-700">{report.unit?.name}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500">Teknisi / Pelaksana</span>
                        <div className="flex items-center gap-2">
                            <span className={`font-bold ${report.technician ? 'text-orange-600' : 'text-slate-400 italic'}`}>
                                {report.technician || 'Belum Ditugaskan'}
                            </span>
                        </div>
                    </div>

                    {report.cost > 0 && (
                        <div className="flex justify-between items-center bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-100">
                            <span className="text-emerald-800 font-bold">Total Biaya Realisasi</span>
                            <span className="font-extrabold text-emerald-700 text-sm">
                                Rp {report.cost.toLocaleString('id-ID')}
                            </span>
                        </div>
                    )}

                    {report.completionDate && (
                        <div className="flex justify-between">
                            <span className="text-slate-500">Selesai Dikerjakan</span>
                            <span className="font-medium text-slate-700">
                                {new Date(report.completionDate).toLocaleDateString('id-ID', { dateStyle: 'full' })}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
