import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, UserPlus, PlayCircle, Wrench, Sparkles, AlertTriangle, Info } from 'lucide-react';
import api from '../lib/axios';
import { getMediaUrl } from '../lib/media';

const statusSteps = [
    { key: 'SUBMITTED', label: 'Diajukan', icon: '📋', color: 'blue' },
    { key: 'APPROVED', label: 'Disetujui', icon: '✅', color: 'cyan' },
    { key: 'ASSIGNED', label: 'Ditugaskan', icon: '👷', color: 'yellow' },
    { key: 'IN_PROGRESS', label: 'Sedang Dikerjakan', icon: '🛠️', color: 'orange' },
    { key: 'COMPLETED', label: 'Selesai', icon: '🎉', color: 'green' },
];

const MaintenanceDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [report, setReport] = useState(null);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const user = JSON.parse(localStorage.getItem('user')) || {};
    const isAdmin = ['SUPER_ADMIN', 'BIDANG_IT', 'ADMIN_ASET', 'KEPALA_BIDANG'].includes(user.role);

    // Modal state for actions
    const [actionModal, setActionModal] = useState({ show: false, type: '', nextStatus: '' });
    const [actionNote, setActionNote] = useState('');
    const [technicianName, setTechnicianName] = useState('');
    const [technicianType, setTechnicianType] = useState('external'); // 'internal' or 'external'
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

    const fetchUsers = async () => {
        try {
            const res = await api.get('/users');
            setUsers(res.data);
        } catch (err) {
            console.error("Failed to fetch users:", err);
        }
    };

    useEffect(() => {
        fetchReport();
        if (isAdmin) fetchUsers();
    }, [id]);

    useEffect(() => {
        if (report) {
            setActionTaken(report.actionTaken || '');
        }
    }, [report]);

    const handleStatusUpdate = async () => {
        try {
            const payload = { status: actionModal.nextStatus };

            if (actionModal.nextStatus === 'APPROVED') payload.approvalNote = actionNote;
            if (actionModal.nextStatus === 'VALIDATED') payload.validationNote = actionNote;
            if (actionModal.nextStatus === 'REJECTED') payload.rejectionReason = actionNote;
            if (actionModal.nextStatus === 'ASSIGNED') payload.technician = technicianName;
            
            // Handle updates where actionTaken is provided (including partial updates)
            if (actionModal.type === 'completion' || actionModal.type === 'progress') {
                payload.actionTaken = actionTaken;
                payload.cost = costInput || report.cost || 0;
            }

            if (actionModal.nextStatus === 'COMPLETED') {
                payload.completionNote = actionNote;
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
    const isAssignedTechnician = report.technician && (report.technician === user.name || report.technician === user.username);

    const getNextAction = () => {
        if (isRejected) return null;

        // Assigned technician actions
        if (!isAdmin && isAssignedTechnician) {
            if (report.status === 'ASSIGNED') {
                return { label: 'Mulai Pengerjaan', nextStatus: 'IN_PROGRESS', type: 'start' };
            }
            if (report.status === 'IN_PROGRESS') {
                return { 
                    label: 'Selesaikan', nextStatus: 'COMPLETED', type: 'completion',
                    secondaryLabel: 'Update Progres', secondaryType: 'progress'
                };
            }
        }

        if (!isAdmin) return null;
        const transitions = {
            'SUBMITTED': { label: 'Setujui', nextStatus: 'APPROVED', type: 'approval', rejectLabel: 'Tolak' },
            'APPROVED': { label: 'Tugaskan Teknisi', nextStatus: 'ASSIGNED', type: 'assignment' },
            'ASSIGNED': [
                { label: 'Mulai Pengerjaan', nextStatus: 'IN_PROGRESS', type: 'start' },
                { label: 'Selesaikan', nextStatus: 'COMPLETED', type: 'completion' }
            ],
            'IN_PROGRESS': { label: 'Selesaikan', nextStatus: 'COMPLETED', type: 'completion' },
        };

        const action = transitions[report.status];
        if (Array.isArray(action)) return action[0]; // Simplified for now, or pick the primary
        return action || null;
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
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-bold text-slate-800">Detail Laporan</h1>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-sm ${report.targetDept === 'PEMBANGUNAN' ? 'bg-orange-500' : 'bg-blue-500'}`}>
                            {report.targetDept === 'PEMBANGUNAN' ? 'PEMBANGUNAN' : 'SARPRAS'}
                        </span>
                    </div>
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
                        <div className="flex justify-between text-xs items-center">
                            <span className="text-slate-500">Bidang Tujuan</span>
                            <span className={`px-2 py-0.5 rounded font-bold ${report.targetDept === 'PEMBANGUNAN' ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                                {report.targetDept === 'PEMBANGUNAN' ? 'Pembangunan' : 'Sarana & Prasarana'}
                            </span>
                        </div>
                        <div className="flex justify-between"><span className="text-slate-500">Tipe</span><span className={`font-semibold ${report.type === 'ASSET' ? 'text-purple-600' : 'text-gray-600'}`}>{report.type === 'ASSET' ? 'Aset Terdata' : 'Non-Aset'}</span></div>

                        {report.assets && report.assets.length > 0 && (
                            <div className="space-y-1">
                                <span className="text-slate-500">Aset Terkait:</span>
                                <div className="space-y-1 mt-1">
                                    {report.assets.map(a => (
                                        <div key={a.id} className="flex justify-between p-2 bg-slate-50 rounded border border-slate-100 font-mono text-xs">
                                            <span className="font-bold text-blue-600">{a.code}</span>
                                            <span className="text-slate-600">{a.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

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

            {/* AI Diagnosis removed for stability */}

            {/* Description & Media Gallery */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                <div>
                    <h3 className="text-sm font-semibold text-slate-600 mb-2">Deskripsi Masalah</h3>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{report.description}</p>
                </div>

                {/* Media Gallery */}
                {(report.media || report.photo) && (
                    <div className="pt-4 border-t border-slate-100">
                        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Media Bukti & Dokumentasi</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {report.media ? (
                                report.media.map((item, idx) => (
                                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-100 bg-slate-50 group">
                                        {item.type === 'IMAGE' ? (
                                            <a href={getMediaUrl(item.url)} target="_blank" rel="noreferrer" className="block w-full h-full">
                                                <img 
                                                    src={getMediaUrl(item.url)} 
                                                    alt={`Evidence ${idx + 1}`} 
                                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                                                />
                                            </a>
                                        ) : (
                                            <video 
                                                src={getMediaUrl(item.url)} 
                                                controls 
                                                className="w-full h-full object-cover"
                                                poster={getMediaUrl(report.photo)}
                                            />
                                        )}
                                        <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/50 text-white text-[8px] rounded font-bold backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                            {item.type}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                // Fallback for single photo
                                <div className="relative aspect-square rounded-xl overflow-hidden border border-slate-100 bg-slate-50 group">
                                    <a href={getMediaUrl(report.photo)} target="_blank" rel="noreferrer" className="block w-full h-full">
                                        <img 
                                            src={getMediaUrl(report.photo)} 
                                            alt="Evidence" 
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                                        />
                                    </a>
                                </div>
                            )}
                        </div>
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
                <div className="flex flex-col md:flex-row gap-3">
                    <button
                        onClick={() => setActionModal({ show: true, type: nextAction.type, nextStatus: nextAction.nextStatus })}
                        className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
                    >
                        <CheckCircle size={18} /> {nextAction.label}
                    </button>
                    
                    {nextAction.secondaryLabel && (
                         <button
                            onClick={() => setActionModal({ show: true, type: nextAction.secondaryType, nextStatus: report.status })}
                            className="flex-1 flex items-center justify-center gap-2 bg-white border-2 border-orange-500 text-orange-600 py-3 rounded-xl font-semibold hover:bg-orange-50 transition-all"
                        >
                            <Sparkles size={18} /> {nextAction.secondaryLabel}
                        </button>
                    )}

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
                            {actionModal.type === 'progress' && 'Update Progres Pekerjaan'}
                            {actionModal.type === 'completion' && 'Selesaikan Pekerjaan'}
                            {actionModal.type === 'rejection' && 'Tolak Laporan'}
                        </h3>

                        {actionModal.type === 'assignment' && (
                            <div className="space-y-4">
                                <div className="flex bg-slate-100 p-1 rounded-lg">
                                    <button
                                        type="button"
                                        onClick={() => { setTechnicianType('external'); setTechnicianName(''); }}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${technicianType === 'external' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        Eksternal / Vendor
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setTechnicianType('internal'); setTechnicianName(''); }}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${technicianType === 'internal' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        Pegawai (Internal)
                                    </button>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                                        {technicianType === 'internal' ? 'Pilih Pegawai *' : 'Nama Teknisi / Vendor *'}
                                    </label>
                                    {technicianType === 'internal' ? (
                                        <select
                                            value={technicianName}
                                            onChange={e => setTechnicianName(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        >
                                            <option value="">-- Pilih Pegawai --</option>
                                            {users
                                                .filter(u => ['Staff Pembangunan', 'Staff Manajemen Aset'].includes(u.position))
                                                .map(u => (
                                                    <option key={u.id} value={u.name || u.username}>{u.name || u.username}</option>
                                                ))
                                            }
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            value={technicianName}
                                            onChange={e => setTechnicianName(e.target.value)}
                                            placeholder="Misal: Pak Ahmad / CV Maju Jaya"
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    )}
                                </div>
                            </div>
                        )}

                        {(actionModal.type === 'completion' || actionModal.type === 'progress') && (
                            <>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Tindakan Perbaikan *</label>
                                    <textarea
                                        value={actionTaken}
                                        onChange={e => setActionTaken(e.target.value)}
                                        placeholder="Jelaskan apa yang sudah/sedang dikerjakan..."
                                        rows={4}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                {actionModal.type === 'completion' && (
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
                                )}
                            </>
                        )}

                        {actionModal.type === 'start' && (
                             <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
                                <Info size={18} className="text-blue-600 mt-0.5" />
                                <p className="text-xs text-blue-700 leading-relaxed">
                                    Status akan berubah menjadi <strong>Sedang Dikerjakan</strong>. Pelapor akan mendapatkan notifikasi bahwa Anda telah memulai perbaikan.
                                </p>
                             </div>
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
