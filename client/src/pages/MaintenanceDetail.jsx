import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, UserPlus, PlayCircle, Wrench, Sparkles, AlertTriangle, Info, Plus, Loader2, ClipboardList, UserCheck, HardHat, Cog, CheckCircle2, Trash2, Edit2, FileText as FileIcon, Clock, Calendar, User, Send, MessageSquare } from 'lucide-react';
import api from '../lib/axios';
import { getMediaUrl } from '../lib/media';

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

const statusSteps = [
    { key: 'SUBMITTED', label: 'Diajukan', icon: ClipboardList, color: 'text-blue-500' },
    { key: 'APPROVED', label: 'Disetujui', icon: UserCheck, color: 'text-cyan-500' },
    { key: 'ASSIGNED', label: 'Ditugaskan', icon: HardHat, color: 'text-yellow-500' },
    { key: 'IN_PROGRESS', label: 'Sedang Dikerjakan', icon: Cog, color: 'text-orange-500' },
    { key: 'COMPLETED', label: 'Selesai', icon: CheckCircle2, color: 'text-green-500' },
];

const MaintenanceDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [report, setReport] = useState(null);
    const [units, setUnits] = useState([]);
    const [users, setUsers] = useState([]);
    const [contractors, setContractors] = useState([]);
    const [loading, setLoading] = useState(true);
    const user = JSON.parse(localStorage.getItem('user')) || {};
    const isAdmin = ['SUPER_ADMIN', 'BIDANG_IT', 'ADMIN_ASET', 'KEPALA_BIDANG', 'ADMIN_PBG'].includes(user.role);
    const [uploadingMedia, setUploadingMedia] = useState(false);

    // Modal state for actions
    const [actionModal, setActionModal] = useState({ show: false, type: '', nextStatus: '' });
    const [historyModal, setHistoryModal] = useState({ show: false, asset: null, timeline: [], loading: false });
    const [actionNote, setActionNote] = useState('');
    const [assignUnitId, setAssignUnitId] = useState('');
    const [technicianName, setTechnicianName] = useState('');
    const [technicianPhone, setTechnicianPhone] = useState('');
    const [technicianType, setTechnicianType] = useState('external'); // 'internal' or 'external'
    const [createWorkshopOrder, setCreateWorkshopOrder] = useState(false);
    const [progressNote, setProgressNote] = useState('');
    const [costItems, setCostItems] = useState([]); // [{ id: string, label: string, price: number, assetId: number|null }]
    const [bulkPrice, setBulkPrice] = useState('');
    const [receiptFile, setReceiptFile] = useState(null);
    const [completionPhoto, setCompletionPhoto] = useState(null);
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
    const [chatMessage, setChatMessage] = useState('');
    const [sendingChat, setSendingChat] = useState(false);
    
    // Mention States
    const [showMentionList, setShowMentionList] = useState(false);
    const [mentionFilter, setMentionFilter] = useState('');
    const [mentionIndex, setMentionIndex] = useState(0);

    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
    };

    const fetchAssetHistory = async (asset) => {
        try {
            setHistoryModal({ show: true, asset, timeline: [], loading: true });
            const res = await api.get(`/assets/${asset.id}`);
            const maintenanceHistory = (res.data.timeline || []).filter(item => item.type === 'MAINTENANCE');
            setHistoryModal({ show: true, asset, timeline: maintenanceHistory, loading: false });
        } catch (err) {
            showToast('Gagal memuat riwayat aset', 'error');
            setHistoryModal({ show: false, asset: null, timeline: [], loading: false });
        }
    };

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

    const markAssetAsCompleted = async (assetId) => {
        if (!confirm('Tandai aset ini sebagai selesai? Prediksi jadwal perbaikannya akan langsung diperbarui.')) return;
        try {
            await api.put(`/maintenance/${id}/complete-asset/${assetId}`);
            showToast('Aset berhasil ditandai selesai');
            fetchReport(); // Refresh data
        } catch (error) {
            showToast(error.response?.data?.error || 'Gagal menandai aset', 'error');
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await api.get('/users');
            setUsers(res.data.map(u => ({
                ...u,
                mentionName: (u.name || u.username).replace(/\s+/g, '_')
            })));
        } catch (err) {
            console.error("Failed to fetch users:", err);
        }
    };

    const fetchUnits = async () => {
        try {
            const res = await api.get('/master/units');
            setUnits(res.data.data || res.data || []);
        } catch (err) {
            console.error("Failed to fetch units:", err);
        }
    };

    const fetchContractors = async () => {
        try {
            const res = await api.get('/contractors', { params: { limit: 'all' } });
            setContractors(res.data.data || []);
        } catch (err) {
            console.error("Failed to fetch contractors:", err);
        }
    };

    useEffect(() => {
        fetchReport();
        fetchUsers();
        if (isAdmin) {
            fetchContractors();
            fetchUnits();
        }
    }, [id]);

    useEffect(() => {
        // No longer pre-filling progressNote
    }, [report]);

    const handleStatusUpdate = async () => {
        try {
            const payload = { status: actionModal.nextStatus };

            if (actionModal.nextStatus === 'APPROVED') payload.approvalNote = actionNote;
            if (actionModal.nextStatus === 'VALIDATED') payload.validationNote = actionNote;
            if (actionModal.nextStatus === 'REJECTED') payload.rejectionReason = actionNote;
            if (actionModal.nextStatus === 'ASSIGNED') {
                payload.technician = technicianName;
                payload.technicianPhone = technicianType === 'external' ? technicianPhone : undefined;
                payload.approvalNote = actionNote;
            }

            // Handle updates where actionTaken is provided (including partial updates)
            if (actionModal.type === 'completion' || actionModal.type === 'progress') {
                if (progressNote.trim()) {
                    const now = new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
                    const newLog = `[${now}] ${progressNote.trim()}`;
                    payload.actionTaken = report.actionTaken ? `${report.actionTaken}\n\n${newLog}` : newLog;
                } else {
                    payload.actionTaken = report.actionTaken || undefined;
                }
                if (actionModal.type === 'completion') {
                    // Calculate total cost from items
                    const totalCost = costItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
                    payload.cost = totalCost;
                    payload.costDetails = costItems.length > 0 ? costItems : undefined;
                }
            }

            // Upload receipt first if available and completing
            if (actionModal.type === 'completion') {
                if (receiptFile) {
                    const formData = new FormData();
                    formData.append('media', receiptFile);
                    await api.post(`/maintenance/${id}/media?isReceipt=true`, formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
                }
                if (completionPhoto) {
                    const formData = new FormData();
                    formData.append('media', completionPhoto);
                    await api.post(`/maintenance/${id}/media?isCompletion=true`, formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
                }
            }

            if (actionModal.nextStatus === 'COMPLETED') {
                payload.completionNote = actionNote;
            }

            await api.put(`/maintenance/${id}/status`, payload);

            if (actionModal.nextStatus === 'ASSIGNED' && technicianType === 'external' && createWorkshopOrder) {
                showToast('Laporan ditugaskan. Mengalihkan ke form Workshop...');
                navigate('/workshop/orders/new', {
                    state: {
                        fromMaintenance: {
                            id: report.id,
                            title: `[MT] ${report.title}`,
                            notes: report.description,
                            unitId: report.unitId
                        }
                    }
                });
                return;
            }

            setActionModal({ show: false, type: '', nextStatus: '' });
            setActionNote('');
            setAssignUnitId('');
            setTechnicianName('');
            setTechnicianPhone('');
            setProgressNote('');
            setCostItems([]);
            setBulkPrice('');
            setReceiptFile(null);
            setCompletionPhoto(null);
            fetchReport();
            showToast('Pembaruan status berhasil disimpan!');
        } catch (err) {
            showToast(err.response?.data?.error || 'Gagal mengubah status', 'error');
        }
    };

    const handleSendChat = async () => {
        if (!chatMessage.trim()) return;
        try {
            setSendingChat(true);
            await api.post(`/maintenance/${id}/progress`, { message: chatMessage.trim() });
            setChatMessage('');
            fetchReport(); // Refresh data to get new chat
        } catch (err) {
            showToast(err.response?.data?.error || 'Gagal mengirim pesan', 'error');
        } finally {
            setSendingChat(false);
        }
    };

    const handleChatChange = (e) => {
        const val = e.target.value;
        setChatMessage(val);
        const cursorPos = e.target.selectionStart;
        const textBeforeCursor = val.slice(0, cursorPos);
        const mentionMatch = textBeforeCursor.match(/@([a-zA-Z0-9_.-]*)$/);
        if (mentionMatch) {
            setMentionFilter(mentionMatch[1]);
            setShowMentionList(true);
            setMentionIndex(0);
        } else {
            setShowMentionList(false);
        }
    };

    const handleSelectMention = (username) => {
        const input = document.getElementById('chat-input-maint');
        const cursorPos = input ? input.selectionStart : chatMessage.length;
        const textBeforeCursor = chatMessage.slice(0, cursorPos);
        const textAfterCursor = chatMessage.slice(cursorPos);
        const newTextBefore = textBeforeCursor.replace(/@([a-zA-Z0-9_.-]*)$/, `@${username} `);
        setChatMessage(newTextBefore + textAfterCursor);
        setShowMentionList(false);
        setTimeout(() => {
            if (input) {
                input.focus();
                input.setSelectionRange(newTextBefore.length, newTextBefore.length);
            }
        }, 0);
    };

    const handleChatKeyDown = (e) => {
        if (showMentionList) {
            const filteredUsers = users.filter(u => (u.mentionName||'').toLowerCase().includes(mentionFilter.toLowerCase()) || (u.name||'').toLowerCase().includes(mentionFilter.toLowerCase()));
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMentionIndex(prev => (prev + 1) % filteredUsers.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setMentionIndex(prev => (prev - 1 + filteredUsers.length) % filteredUsers.length);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (filteredUsers[mentionIndex]) {
                    handleSelectMention(filteredUsers[mentionIndex].mentionName);
                }
            } else if (e.key === 'Escape') {
                setShowMentionList(false);
            }
        } else {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendChat();
            }
        }
    };

    const renderChatMessage = (text) => {
        if (!text) return null;
        const parts = text.split(/(@[a-zA-Z0-9_.-]+)/g);
        return parts.map((part, i) => {
            if (part.startsWith('@')) {
                return <span key={i} className="font-bold text-blue-700 bg-blue-100 px-1 rounded mx-0.5">{part}</span>;
            }
            return <span key={i}>{part}</span>;
        });
    };

    const handleAddMedia = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        try {
            setUploadingMedia(true);
            const formData = new FormData();
            files.forEach(file => formData.append('media', file));

            await api.post(`/maintenance/${id}/media`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            showToast('Dokumentasi tambahan berhasil diunggah!');
            fetchReport();
        } catch (err) {
            showToast(err.response?.data?.error || 'Gagal mengunggah dokumentasi', 'error');
        } finally {
            setUploadingMedia(false);
            e.target.value = null;
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
            'SUBMITTED': { label: 'Setujui & Tugaskan', nextStatus: 'ASSIGNED', type: 'assignment', rejectLabel: 'Tolak' },
            'APPROVED': { label: 'Tugaskan Teknisi', nextStatus: 'ASSIGNED', type: 'assignment' },
            'ASSIGNED': [
                { label: 'Mulai Pengerjaan', nextStatus: 'IN_PROGRESS', type: 'start' },
                { label: 'Selesaikan', nextStatus: 'COMPLETED', type: 'completion' }
            ],
            'IN_PROGRESS': {
                label: 'Selesaikan', nextStatus: 'COMPLETED', type: 'completion',
                secondaryLabel: 'Update Progres', secondaryType: 'progress'
            }
        };
        const action = transitions[report.status];
        if (Array.isArray(action)) return action[0]; // Simplified for now, or pick the primary
        return action || null;
    };

    const nextAction = getNextAction();

    return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6 relative">
            {/* Global Toast Notification */}
            {toast.show && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in-down">
                    <div className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl shadow-black/5 text-sm font-semibold border ${toast.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'
                        }`}>
                        {toast.type === 'error' ? '❌' : '✅'}
                        {toast.message}
                    </div>
                </div>
            )}
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
                                    {isRejected && isCurrent ? <XCircle size={20} className="text-red-500" /> : <step.icon size={20} className={isActive ? step.color : 'text-slate-400'} />}
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
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500">Urgensi</span>
                            {report.urgency && report.urgency !== 'NORMAL' ? (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${urgencyColors[report.urgency]}`}>
                                    {urgencyLabels[report.urgency]}
                                </span>
                            ) : (
                                <span className="font-semibold text-slate-600">Biasa</span>
                            )}
                        </div>
                        <div className="flex justify-between"><span className="text-slate-500">Tipe</span><span className={`font-semibold ${report.type === 'ASSET' ? 'text-purple-600' : 'text-gray-600'}`}>{report.type === 'ASSET' ? 'Aset Terdata' : 'Non-Aset'}</span></div>

                        {report.assets && report.assets.length > 0 && (
                            <div className="space-y-1">
                                <span className="text-slate-500">Aset Terkait:</span>
                                <div className="space-y-1 mt-1">
                                    {report.assets.map(a => {
                                        const isAssetCompleted = report.aiDiagnosis?.completedAssets?.includes(a.id);
                                        const canComplete = report.status === 'IN_PROGRESS' || report.status === 'ASSIGNED';
                                        
                                        return (
                                            <div key={a.id} className="flex justify-between items-center p-2 bg-slate-50 rounded border border-slate-100 font-mono text-xs">
                                                <div>
                                                    <span className="font-bold text-blue-600">{a.code}</span>
                                                    <span className="text-slate-600 ml-2">{a.name}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {isAssetCompleted ? (
                                                        <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded border border-green-200">
                                                            <CheckCircle2 size={12} /> Selesai
                                                        </span>
                                                    ) : (
                                                        canComplete && (
                                                            <button 
                                                                onClick={() => markAssetAsCompleted(a.id)}
                                                                className="flex items-center gap-1 px-2 py-1 bg-white border border-green-200 rounded text-green-600 hover:bg-green-50 transition-colors"
                                                                title="Tandai Selesai & Update Jadwal Rutin"
                                                            >
                                                                <CheckCircle2 size={12} />
                                                                <span>Tandai Selesai</span>
                                                            </button>
                                                        )
                                                    )}
                                                    <button 
                                                        onClick={() => fetchAssetHistory(a)}
                                                        className="flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 rounded text-blue-600 hover:bg-blue-50 transition-colors"
                                                        title="Lihat Riwayat Perbaikan"
                                                    >
                                                        <Clock size={12} />
                                                        <span>Riwayat</span>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
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
                <div className="pt-4 border-t border-slate-100">
                    <div className="flex flex-wrap justify-between items-center mb-3 gap-2">
                        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Media Bukti & Dokumentasi</h3>
                        {(isAdmin || report.userId === user?.id) && (
                            <label className={`cursor-pointer bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ${uploadingMedia ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                {uploadingMedia ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                {uploadingMedia ? 'Mengunggah...' : 'Upload Tambahan'}
                                <input
                                    type="file"
                                    multiple
                                    accept="image/*,video/*"
                                    className="hidden"
                                    onChange={handleAddMedia}
                                    disabled={uploadingMedia}
                                />
                            </label>
                        )}
                    </div>
                    {report.media || report.photo ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
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
                    ) : (
                        <div className="text-sm text-slate-400 italic text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            Belum ada dokumentasi media / foto
                        </div>
                    )}
                </div>
            </div>

            {/* Workshop Orders Section */}
            {report.workshopOrders && report.workshopOrders.length > 0 && (
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 space-y-3">
                    <h3 className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                        <Wrench size={18} /> Pesanan Workshop Terkait
                    </h3>
                    <div className="space-y-2">
                        {report.workshopOrders.map(wo => (
                            <div key={wo.id} className="flex justify-between items-center bg-white p-3 border border-slate-200 rounded-lg">
                                <div>
                                    <div className="font-semibold text-slate-700">{wo.title}</div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs text-slate-500 font-mono">{wo.code}</span>
                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded font-bold">{wo.status}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => navigate(`/workshop/orders/${wo.id}`)}
                                    className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded"
                                >
                                    Lihat Detail
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Nota / Bukti Pembayaran Section */}
            {report.media?.some(m => m.isReceipt) && (
                <div className="bg-amber-50 rounded-xl border border-amber-200 p-5 space-y-3 animate-in fade-in slide-in-from-top-4 duration-500">
                    <h3 className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                        <FileIcon size={18} /> Nota / Bukti Pembayaran
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {report.media.filter(m => m.isReceipt).map((item, idx) => (
                            <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-amber-100 bg-white group shadow-sm">
                                <a href={getMediaUrl(item.url)} target="_blank" rel="noreferrer" className="block w-full h-full">
                                    <img
                                        src={getMediaUrl(item.url)}
                                        alt={`Receipt ${idx + 1}`}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                    />
                                </a>
                                <div className="absolute top-2 right-2 p-1 bg-amber-500 text-white rounded-full shadow-lg">
                                    <CheckCircle size={10} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Foto Penyelesaian Section */}
            {report.media?.some(m => m.isCompletion) && (
                <div className="bg-green-50 rounded-xl border border-green-200 p-5 space-y-3 animate-in fade-in slide-in-from-top-4 duration-500">
                    <h3 className="text-sm font-semibold text-green-800 flex items-center gap-2">
                        <CheckCircle2 size={18} /> Foto Penyelesaian Pekerjaan
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {report.media.filter(m => m.isCompletion).map((item, idx) => (
                            <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-green-100 bg-white group shadow-sm">
                                <a href={getMediaUrl(item.url)} target="_blank" rel="noreferrer" className="block w-full h-full">
                                    <img
                                        src={getMediaUrl(item.url)}
                                        alt={`Selesai ${idx + 1}`}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                    />
                                </a>
                                <div className="absolute top-2 right-2 p-1 bg-green-500 text-white rounded-full shadow-lg">
                                    <CheckCircle size={10} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Action Taken & Costs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {report.actionTaken && (
                    <div className="bg-green-50 rounded-xl border border-green-200 p-5">
                        <h3 className="text-sm font-semibold text-green-700 mb-2">Riwayat & Tindakan Perbaikan</h3>
                        <div className="text-sm text-green-800 whitespace-pre-wrap font-mono relative">
                            {report.actionTaken}
                        </div>
                    </div>
                )}

                {(report.cost > 0 || report.status === 'COMPLETED') && (
                    <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-sm font-semibold text-slate-700">Rincian Biaya</h3>
                            <span className="font-bold text-slate-800 text-lg">Rp {report.cost.toLocaleString('id-ID')}</span>
                        </div>
                        {report.costDetails && report.costDetails.length > 0 ? (
                            <div className="space-y-2 mt-3 bg-white p-3 rounded-lg border border-slate-100 max-h-48 overflow-y-auto">
                                {report.costDetails.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-xs pb-2 border-b border-slate-50 last:border-0 last:pb-0">
                                        <div>
                                            <span className="font-medium text-slate-700">{item.label}</span>
                                            {item.assetId && (
                                                <div className="text-[9px] text-blue-600 font-mono mt-0.5">
                                                    Target: {report.assets?.find(a => a.id === item.assetId)?.code || 'Aset Terpilih'}
                                                </div>
                                            )}
                                        </div>
                                        <span className="font-semibold text-slate-600">Rp {item.price?.toLocaleString('id-ID')}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-xs text-slate-500 italic text-center py-2">
                                {report.status === 'COMPLETED' ? 'Belum ada rincian biaya yang dimasukkan.' : 'Detail biaya tidak tersedia untuk laporan lama.'}
                            </div>
                        )}
                    </div>
                )}
            </div>

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

            {/* Edit Biaya & Nota Button for Completed Reports */}
            {!nextAction && report.status === 'COMPLETED' && (isAdmin || isAssignedTechnician) && (
                <button
                    onClick={() => {
                        setCostItems(report.costDetails || []);
                        setProgressNote('');
                        setActionNote(report.completionNote || '');
                        setActionModal({ show: true, type: 'completion', nextStatus: 'COMPLETED' });
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white py-4 rounded-xl font-black shadow-xl shadow-slate-200 hover:bg-slate-900 transition-all uppercase tracking-widest text-xs"
                >
                    <Edit2 size={16} /> Edit Biaya & Nota Pembayaran
                </button>
            )}

            {/* Diskusi / Chat */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 flex flex-col mt-6 shadow-sm">
                <div className="flex items-center gap-2 border-b pb-3">
                    <MessageSquare size={18} className="text-blue-600" />
                    <h3 className="text-sm font-semibold text-slate-700">Diskusi Laporan</h3>
                </div>
                
                <div className="flex-1 space-y-4 overflow-y-auto max-h-80 pr-2">
                    {report.progress && report.progress.length > 0 ? (
                        report.progress.map((msg, idx) => {
                            const isMine = msg.userId === user?.id;
                            const isTechnician = msg.user?.role !== 'USER' && msg.user?.role !== 'ADMIN_UNIT';
                            
                            return (
                                <div key={idx} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-[10px] font-bold ${isMine ? 'text-blue-600' : (isTechnician ? 'text-orange-600' : 'text-slate-500')}`}>
                                            {isMine ? 'Anda' : (msg.user?.name || msg.user?.username)} {isTechnician && !isMine && '(Admin/Teknisi)'}
                                        </span>
                                        <span className="text-[9px] text-slate-400">
                                            {new Date(msg.createdAt).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                                        </span>
                                    </div>
                                    <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm shadow-sm ${
                                        isMine 
                                            ? 'bg-blue-600 text-white rounded-tr-sm' 
                                            : (isTechnician ? 'bg-amber-50 text-amber-900 border border-amber-200 rounded-tl-sm' : 'bg-slate-100 text-slate-700 border border-slate-200 rounded-tl-sm')
                                    }`}>
                                        <p className="whitespace-pre-wrap">{renderChatMessage(msg.message)}</p>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center py-6 text-sm text-slate-400 italic">
                            Belum ada pesan diskusi.
                        </div>
                    )}
                </div>

                <div className="flex items-end gap-2 pt-3 border-t relative">
                    {showMentionList && (
                        <div className="absolute bottom-full left-0 mb-2 w-64 bg-white border border-slate-200 shadow-xl rounded-xl overflow-hidden z-50 flex flex-col max-h-48">
                            {users.filter(u => (u.mentionName||'').toLowerCase().includes(mentionFilter.toLowerCase()) || (u.name||'').toLowerCase().includes(mentionFilter.toLowerCase())).length === 0 ? (
                                <div className="p-3 text-sm text-slate-500 italic text-center">User tidak ditemukan</div>
                            ) : (
                                users.filter(u => (u.mentionName||'').toLowerCase().includes(mentionFilter.toLowerCase()) || (u.name||'').toLowerCase().includes(mentionFilter.toLowerCase())).map((u, i) => (
                                    <button
                                        key={u.id}
                                        onClick={() => handleSelectMention(u.mentionName)}
                                        className={`px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors ${i === mentionIndex ? 'bg-blue-50' : ''}`}
                                    >
                                        <div className="font-bold text-slate-800">{u.name}</div>
                                        <div className="text-[10px] text-slate-500">{u.username}</div>
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                    <textarea
                        id="chat-input-maint"
                        value={chatMessage}
                        onChange={handleChatChange}
                        onKeyDown={handleChatKeyDown}
                        placeholder="Ketik pesan... (@username untuk mention)"
                        rows={1}
                        className="flex-1 max-h-24 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm resize-y focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                    <button
                        onClick={handleSendChat}
                        disabled={sendingChat || !chatMessage.trim()}
                        className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shrink-0 flex items-center justify-center"
                    >
                        {sendingChat ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    </button>
                </div>
            </div>

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
                                        onClick={() => { setTechnicianType('external'); setTechnicianName(''); setTechnicianPhone(''); }}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${technicianType === 'external' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        {report?.targetDept === 'PEMBANGUNAN' ? 'Database Tukang' : 'Eksternal / Vendor'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setTechnicianType('internal'); setTechnicianName(''); setTechnicianPhone(''); setAssignUnitId(''); }}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${technicianType === 'internal' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        Pegawai (Internal)
                                    </button>
                                </div>

                                <div>
                                    {technicianType === 'internal' ? (
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-700 mb-1">Pilih Unit Pegawai *</label>
                                                <select
                                                    value={assignUnitId}
                                                    onChange={e => {
                                                        setAssignUnitId(e.target.value);
                                                        setTechnicianName('');
                                                    }}
                                                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                                                >
                                                    <option value="">-- Pilih Unit --</option>
                                                    {units.map(u => (
                                                        <option key={u.id} value={u.id}>{u.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            {assignUnitId && (
                                                <div className="animate-in slide-in-from-top-2 duration-300">
                                                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Pilih Pegawai (Teknisi) *</label>
                                                    <select
                                                        value={technicianName}
                                                        onChange={e => setTechnicianName(e.target.value)}
                                                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                                                    >
                                                        <option value="">-- Pilih Pegawai --</option>
                                                        {users
                                                            .filter(u =>
                                                                u.unitId === parseInt(assignUnitId) &&
                                                                (
                                                                    u.role === 'ADMIN_ASET' ||
                                                                    (u.position && u.position.toLowerCase().includes('sarpras unit'))
                                                                )
                                                            )
                                                            .map(u => (
                                                                <option key={u.id} value={u.name || u.username}>{u.name || u.username}</option>
                                                            ))
                                                        }
                                                    </select>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <label className="block text-sm font-semibold text-slate-700 mb-1">
                                                Nama Teknisi / Vendor *
                                            </label>
                                            {report?.targetDept === 'PEMBANGUNAN' ? (
                                                <select
                                                    value={technicianName}
                                                    onChange={e => {
                                                        const selectedName = e.target.value;
                                                        setTechnicianName(selectedName);
                                                        const c = contractors.find(ct => ct.name === selectedName);
                                                        if (c && c.phone) {
                                                            setTechnicianPhone(c.phone);
                                                        } else {
                                                            setTechnicianPhone('');
                                                        }
                                                    }}
                                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                >
                                                    <option value="">-- Pilih Tukang dari Database --</option>
                                                    {contractors.map(c => (
                                                        <option key={c.id} value={c.name}>{c.name} {c.specialty ? `(${c.specialty})` : ''}</option>
                                                    ))}
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

                                            <div>
                                                <label className="block text-xs font-semibold text-slate-600 mb-1">
                                                    Nomor WA {report?.targetDept === 'PEMBANGUNAN' ? 'Tukang' : 'Vendor / Teknisi'}
                                                </label>
                                                <input
                                                    type="text"
                                                    value={technicianPhone}
                                                    onChange={e => setTechnicianPhone(e.target.value)}
                                                    placeholder="Misal: 08123456789 (Opsional)"
                                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                />
                                            </div>

                                            <div className="flex items-center gap-2 mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                                                <input
                                                    type="checkbox"
                                                    id="createWorkshopOrder"
                                                    checked={createWorkshopOrder}
                                                    onChange={e => setCreateWorkshopOrder(e.target.checked)}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                                />
                                                <label htmlFor="createWorkshopOrder" className="text-sm font-semibold text-blue-800 cursor-pointer">
                                                    Buat Pesanan ke Workshop Terkait
                                                </label>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {(actionModal.type === 'completion' || actionModal.type === 'progress') && (
                            <>
                                {report.actionTaken && (
                                    <div className="mb-4">
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">Riwayat Progres Sebelumnya</label>
                                        <div className="bg-slate-100 p-3 rounded-lg text-xs text-slate-600 whitespace-pre-wrap font-mono max-h-32 overflow-y-auto border border-slate-200">
                                            {report.actionTaken}
                                        </div>
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                                        {actionModal.type === 'completion' ? 'Tindakan Penyelesaian (Final) *' : 'Update Progres Baru *'}
                                    </label>
                                    <textarea
                                        value={progressNote}
                                        onChange={e => setProgressNote(e.target.value)}
                                        placeholder="Ketik apa yang telah dikerjakan saat ini..."
                                        rows={3}
                                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                {actionModal.type === 'completion' && (
                                    <div className="border-t border-slate-200 pt-4 mt-4">
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="block text-sm font-semibold text-slate-700">Rincian Biaya (Rp)</label>
                                            <span className="text-sm font-bold text-slate-800">
                                                Total: Rp {costItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0).toLocaleString('id-ID')}
                                            </span>
                                        </div>

                                        {/* Adaptive UI Logic */}
                                        {report.assets && report.assets.length > 1 ? (
                                            <div className="space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                                                <div className="flex items-end gap-2">
                                                    <div className="flex-1">
                                                        <label className="block text-xs font-semibold text-slate-600 mb-1">Biaya per Unit (Apply Semua)</label>
                                                        <input
                                                            type="number"
                                                            value={bulkPrice}
                                                            onChange={e => setBulkPrice(e.target.value)}
                                                            placeholder="Contoh: 75000"
                                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            if (!bulkPrice) return;
                                                            const newItems = report.assets.map(asset => ({
                                                                id: Math.random().toString(),
                                                                label: 'Service Rutin',
                                                                price: parseFloat(bulkPrice),
                                                                assetId: asset.id
                                                            }));
                                                            setCostItems(newItems);
                                                        }}
                                                        className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700"
                                                    >
                                                        Terapkan
                                                    </button>
                                                </div>

                                                {/* Asset Checklist / Cost List */}
                                                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                                    {report.assets.map(asset => {
                                                        const assetCosts = costItems.filter(ci => ci.assetId === asset.id);
                                                        const totalAssetCost = assetCosts.reduce((s, ci) => s + (parseFloat(ci.price) || 0), 0);
                                                        return (
                                                            <div key={asset.id} className="bg-white p-2 border border-slate-200 rounded-lg text-xs">
                                                                <div className="flex justify-between items-center font-semibold text-slate-700">
                                                                    <span>{asset.code}</span>
                                                                    <span className={totalAssetCost > 0 ? 'text-green-600' : 'text-slate-400'}>
                                                                        Rp {totalAssetCost.toLocaleString('id-ID')}
                                                                    </span>
                                                                </div>
                                                                {assetCosts.map(ci => (
                                                                    <div key={ci.id} className="flex justify-between items-center mt-1 pl-2 border-l-2 border-slate-100 text-[10px] text-slate-500">
                                                                        <span>{ci.label}</span>
                                                                        <div className="flex items-center gap-2">
                                                                            <span>Rp {ci.price.toLocaleString('id-ID')}</span>
                                                                            <button onClick={() => setCostItems(prev => prev.filter(p => p.id !== ci.id))} className="text-red-500 hover:text-red-700"><Trash2 size={12} /></button>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                                <button
                                                                    onClick={() => setCostItems(prev => [...prev, { id: Math.random().toString(), label: 'Biaya Ekstra', price: 0, assetId: asset.id }])}
                                                                    className="mt-2 text-[10px] font-bold text-blue-600 flex items-center gap-1 hover:underline"
                                                                >
                                                                    <Plus size={10} /> Tambah Item Khusus
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {costItems.map((item, idx) => (
                                                    <div key={item.id} className="flex gap-2 items-center">
                                                        <input
                                                            type="text"
                                                            value={item.label}
                                                            onChange={e => {
                                                                const newItems = [...costItems];
                                                                newItems[idx].label = e.target.value;
                                                                setCostItems(newItems);
                                                            }}
                                                            placeholder="Nama Item (misal: Busi)"
                                                            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                        />
                                                        <input
                                                            type="number"
                                                            value={item.price}
                                                            onChange={e => {
                                                                const newItems = [...costItems];
                                                                newItems[idx].price = parseFloat(e.target.value) || 0;
                                                                setCostItems(newItems);
                                                            }}
                                                            placeholder="Harga"
                                                            className="w-1/3 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                        />
                                                        <button onClick={() => setCostItems(prev => prev.filter(p => p.id !== item.id))} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                                                    </div>
                                                ))}
                                                <button
                                                    onClick={() => setCostItems(prev => [...prev, { id: Math.random().toString(), label: '', price: 0, assetId: report.assets?.[0]?.id || null }])}
                                                    className="w-full py-2 border border-dashed border-slate-300 text-slate-500 rounded-lg text-xs font-bold hover:bg-slate-50 flex items-center justify-center gap-1"
                                                >
                                                    <Plus size={14} /> Tambah Rincian Biaya
                                                </button>
                                            </div>
                                        )}

                                        {/* Nota & Foto Penyelesaian Upload */}
                                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-semibold text-slate-700 mb-1">Upload Nota (Opsional)</label>
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={e => setReceiptFile(e.target.files[0])}
                                                        className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                                    />
                                                    {receiptFile && <CheckCircle size={20} className="text-green-500 flex-shrink-0" />}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-semibold text-slate-700 mb-1">Foto Bukti Selesai (Opsional)</label>
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="file"
                                                        accept="image/*,video/*"
                                                        onChange={e => setCompletionPhoto(e.target.files[0])}
                                                        className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                                                    />
                                                    {completionPhoto && <CheckCircle size={20} className="text-green-500 flex-shrink-0" />}
                                                </div>
                                            </div>
                                        </div>
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

            {/* History Modal */}
            {historyModal.show && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-2xl max-h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center border-b pb-3">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Riwayat Perbaikan Aset</h3>
                                <p className="text-sm text-slate-500 font-mono">{historyModal.asset?.code} - <span className="font-sans">{historyModal.asset?.name}</span></p>
                            </div>
                            <button onClick={() => setHistoryModal({ show: false, asset: null, timeline: [], loading: false })} className="text-slate-400 hover:text-slate-600">
                                <XCircle size={24} />
                            </button>
                        </div>
                        
                        <div className="overflow-y-auto flex-1 pr-2 space-y-4">
                            {historyModal.loading ? (
                                <div className="flex justify-center items-center py-10 text-slate-400">
                                    <Loader2 size={24} className="animate-spin" />
                                </div>
                            ) : historyModal.timeline.length > 0 ? (
                                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                                    {historyModal.timeline.map((item, idx) => (
                                        <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                            <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-100 text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                                                <Wrench size={16} />
                                            </div>
                                            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                                <div className="flex items-center justify-between space-x-2 mb-1">
                                                    <div className="font-bold text-slate-800 text-sm">{item.description}</div>
                                                    {item.id && item.type === 'MAINTENANCE' && (
                                                        <button 
                                                            onClick={() => {
                                                                setHistoryModal({ show: false, asset: null, timeline: [], loading: false });
                                                                navigate(`/pemeliharaan/${item.id}`);
                                                            }}
                                                            className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition-colors"
                                                        >
                                                            Lihat Detail
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="text-xs text-slate-500 space-y-1 mt-2">
                                                    <div className="flex items-center gap-1"><Calendar size={12}/> {new Date(item.date).toLocaleDateString('id-ID')}</div>
                                                    {item.subTitle && <div className="flex items-center gap-1"><User size={12}/> {item.subTitle}</div>}
                                                    <div className="font-semibold text-blue-600 mt-1">Status: {item.status}</div>
                                                    
                                                    {item.issue && (
                                                        <div className="mt-2 text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                                                            <span className="font-semibold block mb-0.5">Masalah/Keluhan:</span>
                                                            <div className="whitespace-pre-wrap">{item.issue}</div>
                                                        </div>
                                                    )}
                                                    {item.note && (
                                                        <div className="mt-2 text-xs text-slate-600 bg-blue-50 p-2 rounded border border-blue-100">
                                                            <span className="font-semibold block mb-0.5">Catatan/Tindakan:</span>
                                                            <div className="whitespace-pre-wrap">{item.note}</div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-10 text-sm text-slate-500 italic">
                                    Belum ada riwayat perbaikan untuk aset ini.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MaintenanceDetail;
