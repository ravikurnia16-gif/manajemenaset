import React from 'react';
import { ArrowLeft, Printer, XCircle, ClipboardList, UserCheck, HardHat, Cog, CheckCircle2 } from 'lucide-react';

const statusSteps = [
    { key: 'SUBMITTED', label: 'Diajukan', icon: ClipboardList, color: 'text-blue-500' },
    { key: 'APPROVED', label: 'Disetujui', icon: UserCheck, color: 'text-cyan-500' },
    { key: 'ASSIGNED', label: 'Ditugaskan', icon: HardHat, color: 'text-yellow-500' },
    { key: 'IN_PROGRESS', label: 'Sedang Dikerjakan', icon: Cog, color: 'text-orange-500' },
    { key: 'COMPLETED', label: 'Selesai', icon: CheckCircle2, color: 'text-green-500' },
];

export default function MaintenanceHeader({
    report,
    onBack,
    onOpenSPK
}) {
    const currentStepIndex = statusSteps.findIndex(s => s.key === report.status);
    const isRejected = report.status === 'REJECTED';

    return (
        <div className="space-y-6">
            {/* Top Bar with Back & SPK Print Button */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold text-slate-800">Detail Laporan Pemeliharaan</h1>
                            <span className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold text-white shadow-xs ${
                                report.targetDept === 'PEMBANGUNAN' ? 'bg-orange-500' : 'bg-blue-600'
                            }`}>
                                {report.targetDept === 'PEMBANGUNAN' ? 'PEMBANGUNAN' : 'SARPRAS'}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">{report.code}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                        onClick={onOpenSPK}
                        className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                        title="Cetak Surat Perintah Kerja (SPK) / Berita Acara"
                    >
                        <Printer size={15} /> Cetak SPK
                    </button>
                </div>
            </div>

            {/* Progress Bar Tahapan */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Tahapan Pengerjaan</h3>
                <div className="flex items-center justify-between gap-1 overflow-x-auto pb-2">
                    {statusSteps.map((step, i) => {
                        const isActive = i <= currentStepIndex && !isRejected;
                        const isCurrent = step.key === report.status;
                        return (
                            <div key={step.key} className="flex flex-col items-center flex-1 min-w-[75px]">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg border-2 transition-all ${
                                    isActive ? 'border-green-500 bg-green-50 shadow-2xs' : isCurrent && isRejected ? 'border-red-500 bg-red-50' : 'border-slate-200 bg-slate-50'
                                }`}>
                                    {isRejected && isCurrent ? (
                                        <XCircle size={20} className="text-red-500" />
                                    ) : (
                                        <step.icon size={20} className={isActive ? step.color : 'text-slate-400'} />
                                    )}
                                </div>
                                <span className={`mt-1.5 text-[10px] font-bold text-center ${isActive ? 'text-green-700' : 'text-slate-400'}`}>
                                    {step.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
                {isRejected && (
                    <div className="mt-4 p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                        <strong>Alasan Penolakan:</strong> {report.rejectionReason || '-'}
                    </div>
                )}
            </div>
        </div>
    );
}
