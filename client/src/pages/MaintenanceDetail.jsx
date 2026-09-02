import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    ArrowLeft, 
    CheckCircle, 
    XCircle, 
    UserPlus, 
    PlayCircle, 
    Wrench, 
    Sparkles, 
    AlertTriangle, 
    Info, 
    Plus, 
    Loader2, 
    ClipboardList, 
    UserCheck, 
    HardHat, 
    Cog, 
    CheckCircle2, 
    Trash2, 
    Edit2, 
    FileText as FileIcon, 
    Clock, 
    Calendar, 
    User, 
    Send, 
    MessageSquare,
    Printer,
    Search,
    ChevronLeft,
    ChevronRight,
    Download,
    ExternalLink,
    Maximize2,
    X,
    Building,
    PhoneCall
} from 'lucide-react';
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
    const [showSPKModal, setShowSPKModal] = useState(false);
    
    // Lightbox State
    const [lightbox, setLightbox] = useState({ show: false, items: [], index: 0 });

    // Action Form States
    const [actionNote, setActionNote] = useState('');
    const [assignUnitId, setAssignUnitId] = useState('');
    const [technicianName, setTechnicianName] = useState('');
    const [technicianPhone, setTechnicianPhone] = useState('');
    const [technicianType, setTechnicianType] = useState('internal'); // 'internal' or 'external'
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [createWorkshopOrder, setCreateWorkshopOrder] = useState(false);
    const [progressNote, setProgressNote] = useState('');
    const [costItems, setCostItems] = useState([]);
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
            fetchReport();
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

    // Keyboard support for Lightbox
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!lightbox.show) return;
            if (e.key === 'Escape') setLightbox(prev => ({ ...prev, show: false }));
            if (e.key === 'ArrowRight') handleLightboxNext();
            if (e.key === 'ArrowLeft') handleLightboxPrev();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [lightbox]);

    const openLightbox = (items, startIndex = 0) => {
        if (!items || items.length === 0) return;
        setLightbox({
            show: true,
            items: items.map(item => typeof item === 'string' ? { url: item, type: 'IMAGE', title: 'Media' } : item),
            index: startIndex
        });
    };

    const handleLightboxNext = () => {
        setLightbox(prev => ({
            ...prev,
            index: (prev.index + 1) % prev.items.length
        }));
    };

    const handleLightboxPrev = () => {
        setLightbox(prev => ({
            ...prev,
            index: (prev.index - 1 + prev.items.length) % prev.items.length
        }));
    };

    const handleStatusUpdate = async () => {
        try {
            const payload = { status: actionModal.nextStatus };

            if (actionModal.nextStatus === 'APPROVED') payload.approvalNote = actionNote;
            if (actionModal.nextStatus === 'VALIDATED') payload.validationNote = actionNote;
            if (actionModal.nextStatus === 'REJECTED') payload.rejectionReason = actionNote;
            if (actionModal.nextStatus === 'ASSIGNED') {
                payload.technician = technicianName;
                payload.technicianPhone = technicianPhone || undefined;
                payload.approvalNote = actionNote;
            }

            if (actionModal.type === 'completion' || actionModal.type === 'progress') {
                if (progressNote.trim()) {
                    const now = new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
                    const newLog = `[${now}] ${progressNote.trim()}`;
                    payload.actionTaken = report.actionTaken ? `${report.actionTaken}\n\n${newLog}` : newLog;
                } else {
                    payload.actionTaken = report.actionTaken || undefined;
                }
                if (actionModal.type === 'completion') {
                    const totalCost = costItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
                    payload.cost = totalCost;
                    payload.costDetails = costItems.length > 0 ? costItems : undefined;
                }
            }

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
            setUserSearchQuery('');
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
            fetchReport();
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
    const isAssignedTechnician = report.technician && (report.technician === user.name || report.technician === user.username);

    const getNextAction = () => {
        if (isRejected) return null;

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
            'APPROVED': { label: 'Tugaskan Teknisi', nextStatus: 'ASSIGNED', type: 'assignment', cancelLabel: 'Batalkan Laporan' },
            'ASSIGNED': [
                { label: 'Mulai Pengerjaan', nextStatus: 'IN_PROGRESS', type: 'start', cancelLabel: 'Batalkan Laporan' },
                { label: 'Selesaikan', nextStatus: 'COMPLETED', type: 'completion' }
            ],
            'IN_PROGRESS': {
                label: 'Selesaikan', nextStatus: 'COMPLETED', type: 'completion',
                secondaryLabel: 'Update Progres', secondaryType: 'progress', cancelLabel: 'Batalkan Laporan'
            }
        };
        const action = transitions[report.status];
        if (Array.isArray(action)) return action[0];
        return action || null;
    };

    const nextAction = getNextAction();

    // Prepare media items for lightboxes
    const generalMedia = report.media ? report.media.filter(m => !m.isReceipt && !m.isCompletion) : (report.photo ? [{ url: report.photo, type: 'IMAGE', title: 'Foto Kerusakan' }] : []);
    const receiptMedia = report.media ? report.media.filter(m => m.isReceipt) : [];
    const completionMedia = report.media ? report.media.filter(m => m.isCompletion) : [];

    // Filtered users for assignment (All Users across system with search)
    const filteredAssignableUsers = users.filter(u => {
        if (assignUnitId && u.unitId !== parseInt(assignUnitId)) return false;
        if (userSearchQuery.trim()) {
            const q = userSearchQuery.toLowerCase();
            const name = (u.name || '').toLowerCase();
            const username = (u.username || '').toLowerCase();
            const position = (u.position || '').toLowerCase();
            const unitName = (units.find(un => un.id === u.unitId)?.name || '').toLowerCase();
            return name.includes(q) || username.includes(q) || position.includes(q) || unitName.includes(q);
        }
        return true;
    });

    return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6 relative">
            {/* Global Toast Notification */}
            {toast.show && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in-down">
                    <div className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl shadow-black/5 text-sm font-semibold border ${
                        toast.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'
                    }`}>
                        {toast.type === 'error' ? '❌' : '✅'}
                        {toast.message}
                    </div>
                </div>
            )}

            {/* Header with Back & SPK Print Button */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/pemeliharaan')} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
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
                    {/* SPK Print Button */}
                    <button
                        onClick={() => setShowSPKModal(true)}
                        className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                        title="Cetak Surat Perintah Kerja (SPK) / Berita Acara"
                    >
                        <Printer size={15} /> Cetak SPK
                    </button>
                </div>
            </div>

            {/* Progress Bar */}
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
                                    {isRejected && isCurrent ? <XCircle size={20} className="text-red-500" /> : <step.icon size={20} className={isActive ? step.color : 'text-slate-400'} />}
                                </div>
                                <span className={`mt-1.5 text-[10px] font-bold text-center ${isActive ? 'text-green-700' : 'text-slate-400'}`}>{step.label}</span>
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

            {/* Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-xs">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">Informasi Laporan</h3>
                    <div className="space-y-2.5 text-xs">
                        <div className="flex justify-between"><span className="text-slate-500">Judul</span><span className="font-bold text-slate-800 text-right">{report.title}</span></div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500">Bidang Tujuan</span>
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${report.targetDept === 'PEMBANGUNAN' ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
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
                        <div className="flex justify-between"><span className="text-slate-500">Tipe</span><span className={`font-semibold ${report.type === 'ASSET' ? 'text-purple-600' : 'text-gray-600'}`}>{report.type === 'ASSET' ? 'Aset Terdata' : 'Non-Aset'}</span></div>

                        {report.assets && report.assets.length > 0 && (
                            <div className="space-y-1.5 pt-1">
                                <span className="text-slate-500 font-semibold">Aset Terkait:</span>
                                <div className="space-y-1.5 mt-1">
                                    {report.assets.map(a => {
                                        const isAssetCompleted = report.aiDiagnosis?.completedAssets?.includes(a.id);
                                        const canComplete = report.status === 'IN_PROGRESS' || report.status === 'ASSIGNED';
                                        
                                        return (
                                            <div key={a.id} className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl border border-slate-100 font-mono text-xs">
                                                <div>
                                                    <span className="font-bold text-blue-600">{a.code}</span>
                                                    <span className="text-slate-700 ml-2 font-sans font-medium">{a.name}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    {isAssetCompleted ? (
                                                        <span className="flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-50 px-2 py-1 rounded-lg border border-green-200">
                                                            <CheckCircle2 size={12} /> Selesai
                                                        </span>
                                                    ) : (
                                                        canComplete && (
                                                            <button 
                                                                onClick={() => markAssetAsCompleted(a.id)}
                                                                className="flex items-center gap-1 px-2.5 py-1 bg-white border border-green-200 rounded-lg text-green-700 font-semibold hover:bg-green-50 transition-colors"
                                                                title="Tandai Selesai & Update Jadwal Rutin"
                                                            >
                                                                <CheckCircle2 size={12} />
                                                                <span>Tandai Selesai</span>
                                                            </button>
                                                        )
                                                    )}
                                                    <button 
                                                        onClick={() => fetchAssetHistory(a)}
                                                        className="flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 rounded-lg text-blue-600 font-semibold hover:bg-blue-50 transition-colors"
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

                        {report.location && <div className="flex justify-between"><span className="text-slate-500">Lokasi</span><span className="font-medium text-slate-700">{report.location}</span></div>}
                        <div className="flex justify-between"><span className="text-slate-500">Tanggal Pengajuan</span><span className="font-medium text-slate-700">{new Date(report.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-xs">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">Pelapor & Penanganan</h3>
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
                        <div className="flex justify-between"><span className="text-slate-500">Unit Pemohon</span><span className="font-semibold text-slate-700">{report.unit?.name}</span></div>
                        
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500">Teknisi / Pelaksana</span>
                            <div className="flex items-center gap-2">
                                <span className={`font-bold ${report.technician ? 'text-orange-600' : 'text-slate-400 italic'}`}>
                                    {report.technician || 'Belum Ditugaskan'}
                                </span>
                            </div>
                        </div>

                        {report.cost > 0 && (
                            <div className="flex justify-between items-center bg-emerald-50/60 p-2 rounded-xl border border-emerald-100">
                                <span className="text-emerald-800 font-bold">Total Biaya Realisasi</span>
                                <span className="font-extrabold text-emerald-700 text-sm">Rp {report.cost.toLocaleString('id-ID')}</span>
                            </div>
                        )}
                        {report.completionDate && <div className="flex justify-between"><span className="text-slate-500">Selesai Dikerjakan</span><span className="font-medium text-slate-700">{new Date(report.completionDate).toLocaleDateString('id-ID', { dateStyle: 'full' })}</span></div>}
                    </div>
                </div>
            </div>

            {/* Description & Media Gallery */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
                <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Deskripsi Masalah / Keluhan</h3>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">{report.description}</p>
                </div>

                {/* Media Gallery with In-App Lightbox */}
                <div className="pt-4 border-t border-slate-100">
                    <div className="flex flex-wrap justify-between items-center mb-3 gap-2">
                        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Media Bukti & Dokumentasi Kerusakan</h3>
                        {(isAdmin || report.userId === user?.id) && (
                            <label className={`cursor-pointer bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${uploadingMedia ? 'opacity-50 cursor-not-allowed' : ''}`}>
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
                    {generalMedia.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-3">
                            {generalMedia.map((item, idx) => (
                                <div 
                                    key={idx} 
                                    onClick={() => openLightbox(generalMedia, idx)}
                                    className="relative aspect-square rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 group cursor-pointer shadow-2xs hover:shadow-md transition-all"
                                >
                                    {item.type === 'IMAGE' || !item.type ? (
                                        <img
                                            src={getMediaUrl(item.url || item)}
                                            alt={`Evidence ${idx + 1}`}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                    ) : (
                                        <video
                                            src={getMediaUrl(item.url)}
                                            className="w-full h-full object-cover"
                                            poster={getMediaUrl(report.photo)}
                                        />
                                    )}
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                        <Maximize2 size={20} />
                                    </div>
                                    <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 text-white text-[9px] rounded-md font-bold backdrop-blur-xs">
                                        {item.type || 'IMAGE'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-xs text-slate-400 italic text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            Belum ada dokumentasi media / foto
                        </div>
                    )}
                </div>
            </div>

            {/* Workshop Orders Section */}
            {report.workshopOrders && report.workshopOrders.length > 0 && (
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-3">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                        <Wrench size={16} className="text-blue-600" /> Pesanan Workshop Terkait
                    </h3>
                    <div className="space-y-2">
                        {report.workshopOrders.map(wo => (
                            <div key={wo.id} className="flex justify-between items-center bg-white p-3.5 border border-slate-200 rounded-xl shadow-2xs">
                                <div>
                                    <div className="font-bold text-slate-800 text-xs">{wo.title}</div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[10px] text-slate-500 font-mono">{wo.code}</span>
                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[9px] rounded font-bold">{wo.status}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => navigate(`/workshop/orders/${wo.id}`)}
                                    className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                    Lihat Detail
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Nota / Bukti Pembayaran Section */}
            {receiptMedia.length > 0 && (
                <div className="bg-amber-50/70 rounded-2xl border border-amber-200 p-5 space-y-3">
                    <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-2">
                        <FileIcon size={16} className="text-amber-600" /> Nota / Bukti Pembayaran
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                        {receiptMedia.map((item, idx) => (
                            <div 
                                key={idx} 
                                onClick={() => openLightbox(receiptMedia, idx)}
                                className="relative aspect-square rounded-2xl overflow-hidden border border-amber-200 bg-white group cursor-pointer shadow-2xs hover:shadow-md transition-all"
                            >
                                <img
                                    src={getMediaUrl(item.url)}
                                    alt={`Receipt ${idx + 1}`}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                    <Maximize2 size={20} />
                                </div>
                                <div className="absolute top-2 right-2 p-1 bg-amber-500 text-white rounded-full shadow-md">
                                    <CheckCircle size={12} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Foto Penyelesaian Section */}
            {completionMedia.length > 0 && (
                <div className="bg-emerald-50/70 rounded-2xl border border-emerald-200 p-5 space-y-3">
                    <h3 className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-600" /> Foto Penyelesaian Pekerjaan
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                        {completionMedia.map((item, idx) => (
                            <div 
                                key={idx} 
                                onClick={() => openLightbox(completionMedia, idx)}
                                className="relative aspect-square rounded-2xl overflow-hidden border border-emerald-200 bg-white group cursor-pointer shadow-2xs hover:shadow-md transition-all"
                            >
                                <img
                                    src={getMediaUrl(item.url)}
                                    alt={`Selesai ${idx + 1}`}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                    <Maximize2 size={20} />
                                </div>
                                <div className="absolute top-2 right-2 p-1 bg-emerald-600 text-white rounded-full shadow-md">
                                    <CheckCircle size={12} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Action Taken & Costs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {report.actionTaken && (
                    <div className="bg-emerald-50/60 rounded-2xl border border-emerald-200 p-5 space-y-2">
                        <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Riwayat & Tindakan Perbaikan</h3>
                        <div className="text-xs text-emerald-900 whitespace-pre-wrap font-mono leading-relaxed bg-white/80 p-3 rounded-xl border border-emerald-100 max-h-48 overflow-y-auto">
                            {report.actionTaken}
                        </div>
                    </div>
                )}

                {(report.cost > 0 || report.status === 'COMPLETED') && (
                    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-3">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-200/80">
                            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Rincian Biaya</h3>
                            <span className="font-extrabold text-slate-800 text-base">Rp {report.cost.toLocaleString('id-ID')}</span>
                        </div>
                        {report.costDetails && report.costDetails.length > 0 ? (
                            <div className="space-y-2 bg-white p-3 rounded-xl border border-slate-100 max-h-48 overflow-y-auto">
                                {report.costDetails.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-xs pb-2 border-b border-slate-50 last:border-0 last:pb-0">
                                        <div>
                                            <span className="font-semibold text-slate-700">{item.label}</span>
                                            {item.assetId && (
                                                <div className="text-[10px] text-blue-600 font-mono mt-0.5">
                                                    Target: {report.assets?.find(a => a.id === item.assetId)?.code || 'Aset Terpilih'}
                                                </div>
                                            )}
                                        </div>
                                        <span className="font-bold text-slate-700">Rp {item.price?.toLocaleString('id-ID')}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-xs text-slate-400 italic text-center py-2">
                                {report.status === 'COMPLETED' ? 'Belum ada rincian biaya yang dimasukkan.' : 'Detail biaya tidak tersedia.'}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Action Workflow Buttons */}
            {nextAction && (
                <div className="flex flex-col md:flex-row gap-3">
                    <button
                        onClick={() => setActionModal({ show: true, type: nextAction.type, nextStatus: nextAction.nextStatus })}
                        className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-xs shadow-md transition-all"
                    >
                        <CheckCircle size={16} /> {nextAction.label}
                    </button>

                    {nextAction.secondaryLabel && (
                        <button
                            onClick={() => setActionModal({ show: true, type: nextAction.secondaryType, nextStatus: report.status })}
                            className="flex-1 flex items-center justify-center gap-2 bg-white border-2 border-orange-500 text-orange-600 py-3 rounded-xl font-bold text-xs hover:bg-orange-50 transition-all"
                        >
                            <Sparkles size={16} /> {nextAction.secondaryLabel}
                        </button>
                    )}

                    {nextAction.rejectLabel && (
                        <button
                            onClick={() => setActionModal({ show: true, type: 'rejection', nextStatus: 'REJECTED' })}
                            className="flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl font-bold text-xs shadow-md transition-all"
                        >
                            <XCircle size={16} /> {nextAction.rejectLabel}
                        </button>
                    )}
                    {nextAction.cancelLabel && isAdmin && (
                        <button
                            onClick={() => setActionModal({ show: true, type: 'rejection', nextStatus: 'REJECTED' })}
                            className="flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl font-bold text-xs shadow-md transition-all"
                        >
                            <XCircle size={16} /> {nextAction.cancelLabel}
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
                    className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white py-3.5 rounded-xl font-bold text-xs shadow-md transition-all uppercase tracking-wider"
                >
                    <Edit2 size={15} /> Edit Rincian Biaya & Nota Pembayaran
                </button>
            )}

            {/* Diskusi / Chat Log */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 flex flex-col shadow-xs">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <MessageSquare size={18} className="text-blue-600" />
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Diskusi & Riwayat Komunikasi</h3>
                </div>
                
                <div className="flex-1 space-y-3.5 overflow-y-auto max-h-80 pr-1">
                    {report.progress && report.progress.length > 0 ? (
                        report.progress.map((msg, idx) => {
                            const isMine = msg.userId === user?.id;
                            const isTechnician = msg.user?.role !== 'USER' && msg.user?.role !== 'ADMIN_UNIT';
                            
                            return (
                                <div key={idx} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <span className={`text-[10px] font-bold ${isMine ? 'text-blue-600' : (isTechnician ? 'text-orange-600' : 'text-slate-600')}`}>
                                            {isMine ? 'Anda' : (msg.user?.name || msg.user?.username)} {isTechnician && !isMine && '(Admin/Teknisi)'}
                                        </span>
                                        <span className="text-[9px] text-slate-400">
                                            {new Date(msg.createdAt).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                                        </span>
                                    </div>
                                    <div className={`px-4 py-2.5 rounded-2xl max-w-[85%] text-xs shadow-2xs ${
                                        isMine 
                                            ? 'bg-blue-600 text-white rounded-tr-xs' 
                                            : (isTechnician ? 'bg-amber-50 text-amber-900 border border-amber-200 rounded-tl-xs' : 'bg-slate-100 text-slate-800 border border-slate-200 rounded-tl-xs')
                                    }`}>
                                        <p className="whitespace-pre-wrap">{renderChatMessage(msg.message)}</p>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center py-6 text-xs text-slate-400 italic">
                            Belum ada pesan diskusi.
                        </div>
                    )}
                </div>

                <div className="flex items-end gap-2 pt-3 border-t border-slate-100 relative">
                    {showMentionList && (
                        <div className="absolute bottom-full left-0 mb-2 w-64 bg-white border border-slate-200 shadow-xl rounded-2xl overflow-hidden z-50 flex flex-col max-h-48">
                            {users.filter(u => (u.mentionName||'').toLowerCase().includes(mentionFilter.toLowerCase()) || (u.name||'').toLowerCase().includes(mentionFilter.toLowerCase())).length === 0 ? (
                                <div className="p-3 text-xs text-slate-500 italic text-center">User tidak ditemukan</div>
                            ) : (
                                users.filter(u => (u.mentionName||'').toLowerCase().includes(mentionFilter.toLowerCase()) || (u.name||'').toLowerCase().includes(mentionFilter.toLowerCase())).map((u, i) => (
                                    <button
                                        key={u.id}
                                        onClick={() => handleSelectMention(u.mentionName)}
                                        className={`px-4 py-2 text-left text-xs hover:bg-blue-50 transition-colors ${i === mentionIndex ? 'bg-blue-50' : ''}`}
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
                        className="flex-1 max-h-24 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs resize-y focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-slate-700"
                    />
                    <button
                        onClick={handleSendChat}
                        disabled={sendingChat || !chatMessage.trim()}
                        className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shrink-0 flex items-center justify-center"
                    >
                        {sendingChat ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                </div>
            </div>

            {/* Action Modal (Assignment, Completion, etc.) */}
            {actionModal.show && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                            <h3 className="text-base font-bold text-slate-800">
                                {actionModal.type === 'approval' && 'Persetujuan Laporan'}
                                {actionModal.type === 'validation' && 'Validasi Laporan'}
                                {actionModal.type === 'assignment' && 'Penugasan Teknisi / Pelaksana'}
                                {actionModal.type === 'start' && 'Mulai Pengerjaan'}
                                {actionModal.type === 'progress' && 'Update Progres Pekerjaan'}
                                {actionModal.type === 'completion' && 'Selesaikan Pekerjaan'}
                                {actionModal.type === 'rejection' && 'Tolak Laporan'}
                            </h3>
                            <button onClick={() => setActionModal({ show: false, type: '', nextStatus: '' })} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Assignment Mode with Universal All-Users Search */}
                        {actionModal.type === 'assignment' && (
                            <div className="space-y-4">
                                <div className="flex bg-slate-100 p-1 rounded-xl">
                                    <button
                                        type="button"
                                        onClick={() => { setTechnicianType('internal'); setTechnicianName(''); setTechnicianPhone(''); }}
                                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${technicianType === 'internal' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        Pegawai Internal (Semua User)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setTechnicianType('external'); setTechnicianName(''); setTechnicianPhone(''); setAssignUnitId(''); }}
                                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${technicianType === 'external' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        {report?.targetDept === 'PEMBANGUNAN' ? 'Database Tukang' : 'Eksternal / Vendor'}
                                    </button>
                                </div>

                                {technicianType === 'internal' ? (
                                    <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Filter Unit (Opsional)</label>
                                            <select
                                                value={assignUnitId}
                                                onChange={e => setAssignUnitId(e.target.value)}
                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="">-- Semua Unit (Seluruh Pegawai) --</option>
                                                {units.map(u => (
                                                    <option key={u.id} value={u.id}>{u.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Cari & Pilih Pegawai (Teknisi) *</label>
                                            <div className="relative mb-2">
                                                <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                                                <input
                                                    type="text"
                                                    value={userSearchQuery}
                                                    onChange={e => setUserSearchQuery(e.target.value)}
                                                    placeholder="Cari nama, username, atau posisi..."
                                                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>

                                            <select
                                                value={technicianName}
                                                onChange={e => {
                                                    const selectedName = e.target.value;
                                                    setTechnicianName(selectedName);
                                                    const u = users.find(usr => (usr.name || usr.username) === selectedName);
                                                    if (u && u.phone) {
                                                        setTechnicianPhone(u.phone);
                                                    } else {
                                                        setTechnicianPhone('');
                                                    }
                                                }}
                                                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 max-h-40"
                                                size={5}
                                                required
                                            >
                                                {filteredAssignableUsers.length === 0 ? (
                                                    <option value="" disabled>Tidak ada user sesuai pencarian</option>
                                                ) : (
                                                    filteredAssignableUsers.map(u => {
                                                        const uUnit = units.find(un => un.id === u.unitId);
                                                        return (
                                                            <option key={u.id} value={u.name || u.username} className="py-1">
                                                                {u.name || u.username} {u.position ? `— ${u.position}` : ''} {uUnit ? `(${uUnit.name})` : ''}
                                                            </option>
                                                        );
                                                    })
                                                )}
                                            </select>
                                        </div>

                                        {technicianName && (
                                            <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200 text-xs text-blue-900 flex justify-between items-center">
                                                <div>
                                                    <span className="font-bold block">Teknisi Terpilih: {technicianName}</span>
                                                    <span className="text-[11px] text-blue-700">{technicianPhone ? `No WA: ${technicianPhone}` : 'Nomor WA belum diisi di profil'}</span>
                                                </div>
                                                {technicianPhone && (
                                                    <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px]">
                                                        WhatsApp Ready
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                                            Nama Teknisi / Vendor Eksternal *
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
                                                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
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
                                                placeholder="Misal: Pak Ahmad / CV Mitra Mandiri"
                                                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                                                required
                                            />
                                        )}

                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                                                Nomor WA {report?.targetDept === 'PEMBANGUNAN' ? 'Tukang' : 'Vendor / Teknisi'}
                                            </label>
                                            <input
                                                type="text"
                                                value={technicianPhone}
                                                onChange={e => setTechnicianPhone(e.target.value)}
                                                placeholder="Misal: 08123456789 (Opsional)"
                                                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>

                                        <div className="flex items-center gap-2 mt-2 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                                            <input
                                                type="checkbox"
                                                id="createWorkshopOrder"
                                                checked={createWorkshopOrder}
                                                onChange={e => setCreateWorkshopOrder(e.target.checked)}
                                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                                            />
                                            <label htmlFor="createWorkshopOrder" className="text-xs font-bold text-blue-900 cursor-pointer">
                                                Buat Pesanan Otomatis ke Workshop Terkait
                                            </label>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Completion / Progress Input */}
                        {(actionModal.type === 'completion' || actionModal.type === 'progress') && (
                            <>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                        {actionModal.type === 'completion' ? 'Tindakan Penyelesaian (Final) *' : 'Update Progres Pekerjaan *'}
                                    </label>
                                    <textarea
                                        value={progressNote}
                                        onChange={e => setProgressNote(e.target.value)}
                                        placeholder="Ketik apa yang telah dikerjakan atau diselesaikan..."
                                        rows={3}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs resize-none focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                                        required
                                    />
                                </div>

                                {actionModal.type === 'completion' && (
                                    <div className="border-t border-slate-100 pt-3 space-y-3">
                                        <div className="flex justify-between items-center">
                                            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Rincian Biaya (Rp)</label>
                                            <span className="text-xs font-extrabold text-slate-800">
                                                Total: Rp {costItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0).toLocaleString('id-ID')}
                                            </span>
                                        </div>

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
                                                        placeholder="Nama Komponen (misal: Busi / Pipa)"
                                                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
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
                                                        className="w-28 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                                                    />
                                                    <button onClick={() => setCostItems(prev => prev.filter(p => p.id !== item.id))} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg">
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => setCostItems(prev => [...prev, { id: Math.random().toString(), label: '', price: 0, assetId: report.assets?.[0]?.id || null }])}
                                                className="w-full py-2 border border-dashed border-slate-300 hover:border-blue-500 text-slate-600 rounded-xl text-xs font-bold hover:bg-blue-50 transition-colors flex items-center justify-center gap-1"
                                            >
                                                <Plus size={14} /> Tambah Rincian Biaya
                                            </button>
                                        </div>

                                        {/* Nota & Completion Photos */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-600 mb-1">Upload Nota Pembayaran</label>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={e => setReceiptFile(e.target.files[0])}
                                                    className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-600 mb-1">Foto Bukti Selesai</label>
                                                <input
                                                    type="file"
                                                    accept="image/*,video/*"
                                                    onChange={e => setCompletionPhoto(e.target.files[0])}
                                                    className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {actionModal.type === 'start' && (
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 flex items-start gap-3">
                                <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
                                <p className="text-xs text-blue-800 leading-relaxed">
                                    Status laporan akan berubah menjadi <strong>Sedang Dikerjakan</strong>. Pelapor dan tim akan menerima notifikasi bahwa perbaikan telah dimulai.
                                </p>
                            </div>
                        )}

                        {actionModal.type !== 'start' && (
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    {actionModal.type === 'rejection' ? 'Alasan Penolakan *' : 'Catatan Tambahan (Opsional)'}
                                </label>
                                <textarea
                                    value={actionNote}
                                    onChange={e => setActionNote(e.target.value)}
                                    placeholder={actionModal.type === 'rejection' ? 'Alasan penolakan laporan...' : 'Catatan persetujuan / verifikasi...'}
                                    rows={2}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs resize-none text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        )}

                        <div className="flex gap-3 pt-3 border-t border-slate-100">
                            <button onClick={() => setActionModal({ show: false, type: '', nextStatus: '' })} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                                Batal
                            </button>
                            <button
                                onClick={handleStatusUpdate}
                                className={`flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition-colors shadow-sm ${
                                    actionModal.type === 'rejection' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                                }`}
                            >
                                Konfirmasi
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* In-App Media Lightbox Modal */}
            {lightbox.show && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200" onClick={() => setLightbox(prev => ({ ...prev, show: false }))}>
                    <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
                        {/* Lightbox Controls */}
                        <div className="absolute -top-12 right-0 flex items-center gap-3 text-white">
                            <span className="text-xs font-mono font-semibold bg-white/20 px-2.5 py-1 rounded-full backdrop-blur-xs">
                                {lightbox.index + 1} / {lightbox.items.length}
                            </span>
                            <a 
                                href={getMediaUrl(lightbox.items[lightbox.index]?.url || lightbox.items[lightbox.index])} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="p-2 hover:bg-white/20 rounded-full transition-colors"
                                title="Buka Tab Baru"
                            >
                                <ExternalLink size={18} />
                            </a>
                            <button onClick={() => setLightbox(prev => ({ ...prev, show: false }))} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                                <X size={22} />
                            </button>
                        </div>

                        {/* Media Display */}
                        <div className="flex items-center justify-center max-h-[75vh] max-w-[85vw] overflow-hidden rounded-2xl bg-black/40 shadow-2xl">
                            {lightbox.items[lightbox.index]?.type === 'VIDEO' ? (
                                <video
                                    src={getMediaUrl(lightbox.items[lightbox.index]?.url || lightbox.items[lightbox.index])}
                                    controls
                                    autoPlay
                                    className="max-h-[75vh] max-w-[85vw] rounded-2xl"
                                />
                            ) : (
                                <img
                                    src={getMediaUrl(lightbox.items[lightbox.index]?.url || lightbox.items[lightbox.index])}
                                    alt="Lightbox Media"
                                    className="max-h-[75vh] max-w-[85vw] object-contain rounded-2xl select-none"
                                />
                            )}
                        </div>

                        {/* Prev / Next Arrows */}
                        {lightbox.items.length > 1 && (
                            <>
                                <button
                                    onClick={handleLightboxPrev}
                                    className="absolute -left-12 top-1/2 -translate-y-1/2 p-3 text-white bg-white/10 hover:bg-white/25 rounded-full transition-all backdrop-blur-xs shadow-lg"
                                    title="Sebelumnya (←)"
                                >
                                    <ChevronLeft size={24} />
                                </button>
                                <button
                                    onClick={handleLightboxNext}
                                    className="absolute -right-12 top-1/2 -translate-y-1/2 p-3 text-white bg-white/10 hover:bg-white/25 rounded-full transition-all backdrop-blur-xs shadow-lg"
                                    title="Selanjutnya (→)"
                                >
                                    <ChevronRight size={24} />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Asset History Modal */}
            {historyModal.show && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-2xl max-h-[80vh] flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                            <div>
                                <h3 className="text-base font-bold text-slate-800">Riwayat Perbaikan Aset</h3>
                                <p className="text-xs text-slate-500 font-mono mt-0.5">{historyModal.asset?.code} - <span className="font-sans font-semibold">{historyModal.asset?.name}</span></p>
                            </div>
                            <button onClick={() => setHistoryModal({ show: false, asset: null, timeline: [], loading: false })} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="overflow-y-auto flex-1 pr-1 space-y-3">
                            {historyModal.loading ? (
                                <div className="flex justify-center items-center py-10 text-slate-400">
                                    <Loader2 size={24} className="animate-spin text-blue-600" />
                                </div>
                            ) : historyModal.timeline.length > 0 ? (
                                historyModal.timeline.map((item, idx) => (
                                    <div key={idx} className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-xs space-y-1.5">
                                        <div className="flex justify-between items-center">
                                            <span className="font-bold text-slate-800">{item.description}</span>
                                            <span className="text-[10px] text-slate-400 font-mono">{new Date(item.date).toLocaleDateString('id-ID')}</span>
                                        </div>
                                        {item.note && <p className="text-slate-600 text-[11px]">{item.note}</p>}
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8 text-xs text-slate-400 italic">
                                    Belum ada riwayat perbaikan sebelumnya untuk aset ini.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── SPK PRINT MODAL & DOCUMENT ── */}
            {showSPKModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Modal Action Bar */}
                        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center no-print">
                            <div className="flex items-center gap-2">
                                <Printer size={18} className="text-blue-600" />
                                <h3 className="font-bold text-slate-800 text-sm">Pratinjau Surat Perintah Kerja (SPK)</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => window.print()}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-colors"
                                >
                                    <Printer size={14} /> Cetak / PDF
                                </button>
                                <button
                                    onClick={() => setShowSPKModal(false)}
                                    className="p-2 hover:bg-slate-200 rounded-xl text-slate-500 transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Printable SPK Document Content */}
                        <div className="p-8 overflow-y-auto print:p-0 print:overflow-visible text-slate-800 text-xs font-sans leading-relaxed space-y-5" id="printable-spk">
                            {/* Kop Surat Yayasan */}
                            <div className="text-center border-b-2 border-slate-800 pb-3">
                                <h2 className="text-base font-black uppercase tracking-wider text-slate-900">YAYASAN DAR EL-IMAN PADANG</h2>
                                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-700">
                                    {report.targetDept === 'PEMBANGUNAN' ? 'BIDANG PEMBANGUNAN & PENGEMBANGAN' : 'BIDANG SARANA & PRASARANA'}
                                </h3>
                                <p className="text-[10px] text-slate-500 mt-0.5">
                                    Jl. Gunung Juaro RT.02 RW.04, Kel. Surau Gadang, Kec. Nanggalo, Kota Padang, Sumatera Barat
                                </p>
                            </div>

                            {/* Judul Dokumen */}
                            <div className="text-center space-y-1">
                                <h1 className="text-sm font-black uppercase tracking-wider underline">SURAT PERINTAH KERJA (SPK) PEMELIHARAAN</h1>
                                <p className="font-mono text-xs font-bold text-slate-700">Nomor: {report.code}</p>
                            </div>

                            {/* Detail Metadata Tabel */}
                            <div className="grid grid-cols-2 gap-4 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200 text-xs">
                                <div className="space-y-1.5">
                                    <div className="flex"><span className="w-28 text-slate-500">Tanggal Terbit</span><span className="font-semibold">: {new Date(report.createdAt).toLocaleDateString('id-ID', { dateStyle: 'long' })}</span></div>
                                    <div className="flex"><span className="w-28 text-slate-500">Unit Pemohon</span><span className="font-semibold">: {report.unit?.name || '-'}</span></div>
                                    <div className="flex"><span className="w-28 text-slate-500">Nama Pelapor</span><span className="font-semibold">: {report.user?.name || report.user?.username || '-'}</span></div>
                                    <div className="flex"><span className="w-28 text-slate-500">Kontak Pelapor</span><span className="font-semibold">: {report.user?.phone || '-'}</span></div>
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex"><span className="w-28 text-slate-500">Teknisi Pelaksana</span><span className="font-bold text-blue-700">: {report.technician || 'Belum Ditugaskan'}</span></div>
                                    <div className="flex"><span className="w-28 text-slate-500">Tingkat Urgensi</span><span className="font-bold">: {urgencyLabels[report.urgency] || 'Biasa'}</span></div>
                                    <div className="flex"><span className="w-28 text-slate-500">Kategori</span><span className="font-semibold">: {report.category === 'ROUTINE' ? 'Pemeliharaan Rutin' : 'Pemeliharaan Insidentil'}</span></div>
                                    <div className="flex"><span className="w-28 text-slate-500">Lokasi Pekerjaan</span><span className="font-semibold">: {report.location || '-'}</span></div>
                                </div>
                            </div>

                            {/* Uraian Keluhan & Masalah */}
                            <div className="space-y-1.5">
                                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 border-b pb-1">1. Uraian Keluhan / Masalah Pekerjaan</h4>
                                <div className="p-3 bg-white border border-slate-200 rounded-xl text-xs space-y-1">
                                    <div className="font-bold text-slate-900">{report.title}</div>
                                    <div className="text-slate-700 whitespace-pre-wrap">{report.description}</div>
                                </div>
                            </div>

                            {/* Tabel Aset Terkait (Jika Ada) */}
                            {report.assets && report.assets.length > 0 && (
                                <div className="space-y-1.5">
                                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 border-b pb-1">2. Daftar Aset Terkait</h4>
                                    <table className="w-full border-collapse border border-slate-200 text-xs text-left">
                                        <thead>
                                            <tr className="bg-slate-100 text-slate-700 font-bold">
                                                <th className="border border-slate-200 p-2 text-center w-8">No</th>
                                                <th className="border border-slate-200 p-2">Kode Aset</th>
                                                <th className="border border-slate-200 p-2">Nama Aset</th>
                                                <th className="border border-slate-200 p-2">Kondisi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {report.assets.map((a, i) => (
                                                <tr key={a.id}>
                                                    <td className="border border-slate-200 p-2 text-center">{i + 1}</td>
                                                    <td className="border border-slate-200 p-2 font-mono font-bold text-blue-600">{a.code}</td>
                                                    <td className="border border-slate-200 p-2">{a.name}</td>
                                                    <td className="border border-slate-200 p-2">{a.condition || 'BAIK'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Lembar Catatan Lapangan & Material Teknisi */}
                            <div className="space-y-1.5">
                                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 border-b pb-1">
                                    3. Lembar Tindakan Perbaikan & Penggunaan Bahan / Material (Diisi Teknisi)
                                </h4>
                                <div className="p-3 border border-slate-200 rounded-xl min-h-[90px] bg-slate-50/50 space-y-2">
                                    {report.actionTaken ? (
                                        <div className="font-mono text-[11px] text-slate-800 whitespace-pre-wrap">{report.actionTaken}</div>
                                    ) : (
                                        <div className="text-[10px] text-slate-400 italic">
                                            Catatan tindakan perbaikan di lapangan & rincian material yang digunakan:
                                            <div className="border-b border-dashed border-slate-300 mt-4 h-4"></div>
                                            <div className="border-b border-dashed border-slate-300 mt-4 h-4"></div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Rincian Biaya (Jika Tersedia) */}
                            {report.cost > 0 && (
                                <div className="space-y-1.5">
                                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 border-b pb-1">4. Realisasi Biaya</h4>
                                    <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                                        <span className="font-semibold text-slate-700">Total Pengeluaran / Biaya Perbaikan</span>
                                        <span className="font-bold text-slate-900 text-sm">Rp {report.cost.toLocaleString('id-ID')}</span>
                                    </div>
                                </div>
                            )}

                            {/* Lembar Tanda Tangan 3 Pihak */}
                            <div className="pt-6 grid grid-cols-3 text-center text-xs gap-4">
                                <div className="space-y-14">
                                    <p className="font-semibold text-slate-600">Pemohon / Pelapor Unit,</p>
                                    <p className="font-bold underline text-slate-900">({report.user?.name || report.user?.username || '...................................'})</p>
                                </div>
                                <div className="space-y-14">
                                    <p className="font-semibold text-slate-600">Teknisi Pelaksana,</p>
                                    <p className="font-bold underline text-slate-900">({report.technician || '...................................'})</p>
                                </div>
                                <div className="space-y-14">
                                    <p className="font-semibold text-slate-600">Mengetahui, Kabid Sarpras</p>
                                    <p className="font-bold underline text-slate-900">(...................................)</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MaintenanceDetail;
