import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, UserPlus, PlayCircle, Wrench } from 'lucide-react';
import api from '../lib/axios';

const statusSteps = [
    { key: 'SUBMITTED', label: 'Diajukan', icon: '📋', color: 'blue' },
    { key: 'APPROVED', label: 'Disetujui', icon: '✅', color: 'cyan' },
    { key: 'VALIDATED', label: 'Tervalidasi', icon: '🔍', color: 'indigo' },
    { key: 'ASSIGNED', label: 'Ditugaskan', icon: '👷', color: 'yellow' },
    { key: 'IN_PROGRESS', label: 'Dikerjakan', icon: '🔧', color: 'orange' },
    { key: 'COMPLETED', label: 'Selesai', icon: '🎉', color: 'green' },
];

const MaintenanceDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const user = JSON.parse(localStorage.getItem('user')) || {};
    const isAdmin = ['SUPER_ADMIN', 'ADMIN_ASET', 'KEPALA_BIDANG'].includes(user.role);

    // Modal state for actions
    const [actionModal, setActionModal] = useState({ show: false, type: '', nextStatus: '' });
    const [actionNote, setActionNote] = useState('');
    const [technicianName, setTechnicianName] = useState('');
    const [actionTaken, setActionTaken] = useState('');
    const [costInput, setCostInput] = useState('');

    const fetchReport = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/maintenance/${id}`);
            setReport(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, [id]);

    const handleStatusUpdate = async () => {
        try {
            const payload = { status: actionModal.nextStatus };

            if (actionModal.nextStatus === 'APPROVED') payload.approvalNote = actionNote;
            if (actionModal.nextStatus === 'VALIDATED') payload.validationNote = actionNote;
            if (actionModal.nextStatus === 'REJECTED') payload.rejectionReason = actionNote;
            if (actionModal.nextStatus === 'ASSIGNED') payload.technician = technicianName;
            if (actionModal.nextStatus === 'COMPLETED') {
                payload.actionTaken = actionTaken;
                payload.completionNote = actionNote;
                payload.cost = costInput || 0;
            }

            await api.put(`/maintenance/${id}/status`, payload);
            setActionModal({ show: false, type: '', nextStatus: '' });
            setActionNote('');
            setTechnicianName('');
            setActionTaken('');
            setCostInput('');
            fetchReport();
        } catch (err) {
            alert(err.response?.data?.error || 'Gagal mengubah status');
        }
    };

    if (loading) return <div className="p-10 text-center text-slate-400">Memuat...</div>;
    if (!report) return <div className="p-10 text-center text-slate-400">Laporan tidak ditemukan.</div>;

    const currentStepIndex = statusSteps.findIndex(s => s.key === report.status);
    const isRejected = report.status === 'REJECTED';

    // What's the next possible action?
    const getNextAction = () => {
        if (isRejected) return null;
        if (!isAdmin) return null;
        const transitions = {
            'SUBMITTED': { label: 'Setujui', nextStatus: 'APPROVED', type: 'approval', rejectLabel: 'Tolak' },
            'APPROVED': { label: 'Validasi', nextStatus: 'VALIDATED', type: 'validation' },
            'VALIDATED': { label: 'Tugaskan Teknisi', nextStatus: 'ASSIGNED', type: 'assignment' },
            'ASSIGNED': { label: 'Mulai Pengerjaan', nextStatus: 'IN_PROGRESS', type: 'start' },
            'IN_PROGRESS': { label: 'Selesaikan', nextStatus: 'COMPLETED', type: 'completion' },
        };
        return transitions[report.status] || null;
    };

    const nextAction = getNextAction();

    return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button onClick={() => navigate('/pemeliharaan')} className="p-2 hover:bg-slate-100 rounded-lg">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-xl font-bold text-slate-800">Detail Laporan</h1>
                    <p className="text-sm text-slate-500 font-mono">{report.code}</p>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-600 mb-4">Progress</h3>
                <div className="flex items-center justify-between gap-1 overflow-x-auto pb-2">
                    {statusSteps.map((step, i) => {
                        const isActive = i <= currentStepIndex && !isRejected;
                        const isCurrent = step.key === report.status;
                        return (
                            <div key={step.key} className="flex flex-col items-center flex-1 min-w-[70px]">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg border-2 transition-all ${isActive ? 'border-green-500 bg-green-50' : isCurrent && isRejected ? 'border-red-500 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
                                    {isRejected && isCurrent ? '❌' : step.icon}
                                </div>
                                <span className={`mt-1 text-[10px] font-semibold text-center ${isActive ? 'text-green-600' : 'text-slate-400'}`}>{step.label}</span>
                                {i < statusSteps.length - 1 && (
                                    <div className={`hidden md:block absolute w-full h-0.5 ${isActive ? 'bg-green-400' : 'bg-slate-200'}`} />
                                )}
                            </div>
                        );
                    })}
                </div>
                {isRejected && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                        <strong>Ditolak:</strong> {report.rejectionReason || '-'}
                    </div>
                )}
            </div>

            {/* Info Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                    <h3 className="text-sm font-semibold text-slate-600 border-b pb-2">Informasi Laporan</h3>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-slate-500">Judul</span><span className="font-medium text-right">{report.title}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Tipe</span><span className={`font-semibold ${report.type === 'ASSET' ? 'text-purple-600' : 'text-gray-600'}`}>{report.type === 'ASSET' ? 'Aset Terdata' : 'Non-Aset'}</span></div>
                        {report.asset && <div className="flex justify-between"><span className="text-slate-500">Aset</span><span className="font-mono text-xs">{report.asset.code} - {report.asset.name}</span></div>}
                        {report.location && <div className="flex justify-between"><span className="text-slate-500">Lokasi</span><span>{report.location}</span></div>}
                        <div className="flex justify-between"><span className="text-slate-500">Tanggal</span><span>{new Date(report.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                    <h3 className="text-sm font-semibold text-slate-600 border-b pb-2">Pelapor & Penanganan</h3>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-slate-500">Pelapor</span><span className="font-medium">{report.user?.name || report.user?.username}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Unit</span><span>{report.unit?.name}</span></div>
                        {report.technician && <div className="flex justify-between"><span className="text-slate-500">Teknisi</span><span className="font-medium text-orange-600">{report.technician}</span></div>}
                        {report.cost > 0 && <div className="flex justify-between"><span className="text-slate-500">Biaya</span><span className="font-semibold">Rp {report.cost.toLocaleString('id-ID')}</span></div>}
                        {report.completionDate && <div className="flex justify-between"><span className="text-slate-500">Selesai</span><span>{new Date(report.completionDate).toLocaleDateString('id-ID')}</span></div>}
                    </div>
                </div>
            </div>

            {/* Description */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-600 mb-2">Deskripsi Masalah</h3>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{report.description}</p>
                {report.photo && (
                    <div className="mt-3">
                        <img src={report.photo} alt="Bukti" className="max-w-xs rounded-lg border" />
                    </div>
                )}
            </div>

            {/* Action Taken */}
            {report.actionTaken && (
                <div className="bg-green-50 rounded-xl border border-green-200 p-5">
                    <h3 className="text-sm font-semibold text-green-700 mb-2">Tindakan Perbaikan</h3>
                    <p className="text-sm text-green-800 whitespace-pre-wrap">{report.actionTaken}</p>
                </div>
            )}

            {/* Action Buttons */}
            {nextAction && (
                <div className="flex gap-3">
                    <button
                        onClick={() => setActionModal({ show: true, type: nextAction.type, nextStatus: nextAction.nextStatus })}
                        className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
                    >
                        <CheckCircle size={18} /> {nextAction.label}
                    </button>
                    {nextAction.rejectLabel && (
                        <button
                            onClick={() => setActionModal({ show: true, type: 'rejection', nextStatus: 'REJECTED' })}
                            className="flex items-center justify-center gap-2 bg-red-500 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:bg-red-600 transition-all"
                        >
                            <XCircle size={18} /> {nextAction.rejectLabel}
                        </button>
                    )}
                </div>
            )}

            {/* Action Modal */}
            {actionModal.show && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
                        <h3 className="text-lg font-bold text-slate-800">
                            {actionModal.type === 'approval' && 'Persetujuan'}
                            {actionModal.type === 'validation' && 'Validasi'}
                            {actionModal.type === 'assignment' && 'Penugasan Teknisi'}
                            {actionModal.type === 'start' && 'Mulai Pengerjaan'}
                            {actionModal.type === 'completion' && 'Selesaikan Pekerjaan'}
                            {actionModal.type === 'rejection' && 'Tolak Laporan'}
                        </h3>

                        {actionModal.type === 'assignment' && (
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Nama Teknisi / Vendor *</label>
                                <input
                                    type="text"
                                    value={technicianName}
                                    onChange={e => setTechnicianName(e.target.value)}
                                    placeholder="Misal: Pak Ahmad / CV Maju Jaya"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                                />
                            </div>
                        )}

                        {actionModal.type === 'completion' && (
                            <>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Tindakan Perbaikan *</label>
                                    <textarea
                                        value={actionTaken}
                                        onChange={e => setActionTaken(e.target.value)}
                                        placeholder="Jelaskan apa yang dikerjakan..."
                                        rows={3}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm resize-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Biaya (Rp)</label>
                                    <input
                                        type="number"
                                        value={costInput}
                                        onChange={e => setCostInput(e.target.value)}
                                        placeholder="0"
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                                    />
                                </div>
                            </>
                        )}

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">
                                {actionModal.type === 'rejection' ? 'Alasan Penolakan *' : 'Catatan (Opsional)'}
                            </label>
                            <textarea
                                value={actionNote}
                                onChange={e => setActionNote(e.target.value)}
                                placeholder={actionModal.type === 'rejection' ? 'Alasan penolakan...' : 'Catatan tambahan...'}
                                rows={3}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm resize-none"
                            />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button onClick={() => setActionModal({ show: false, type: '', nextStatus: '' })} className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50">
                                Batal
                            </button>
                            <button
                                onClick={handleStatusUpdate}
                                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold text-white ${actionModal.type === 'rejection' ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                            >
                                Konfirmasi
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MaintenanceDetail;
