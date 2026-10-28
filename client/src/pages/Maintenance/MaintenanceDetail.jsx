import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    CheckCircle, 
    XCircle, 
    Sparkles, 
    Edit2, 
    Wrench,
    CalendarClock,
    Calendar,
    Clock
} from 'lucide-react';
import dayjs from 'dayjs';
import api from '../../lib/axios';

// Modular Components
import MaintenanceHeader from './components/MaintenanceHeader';
import MaintenanceInfoCards from './components/MaintenanceInfoCards';
import MaintenanceAIDiagnosisCard from './components/MaintenanceAIDiagnosisCard';
import MaintenanceMediaGallery from './components/MaintenanceMediaGallery';
import MaintenanceDiscussion from './components/MaintenanceDiscussion';
import MaintenanceActionModal from './components/MaintenanceActionModal';
import MaintenanceSingleAssetModal from './components/MaintenanceSingleAssetModal';
import MaintenanceSPKModal from './components/MaintenanceSPKModal';
import MaintenanceAssetHistoryModal from './components/MaintenanceAssetHistoryModal';
import MaintenanceEstimationModal from './components/MaintenanceEstimationModal';

const MaintenanceDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    // Data States
    const [report, setReport] = useState(null);
    const [units, setUnits] = useState([]);
    const [users, setUsers] = useState([]);
    const [contractors, setContractors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploadingMedia, setUploadingMedia] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [sendingChat, setSendingChat] = useState(false);

    // Current User
    const user = JSON.parse(localStorage.getItem('user')) || {};
    const isAdmin = ['SUPER_ADMIN', 'BIDANG_IT', 'ADMIN_ASET', 'KEPALA_BIDANG', 'ADMIN_PBG'].includes(user.role);

    // Modal States
    const [actionModal, setActionModal] = useState({ show: false, type: '', nextStatus: '' });
    const [historyModal, setHistoryModal] = useState({ show: false, asset: null, timeline: [], loading: false });
    const [singleAssetModal, setSingleAssetModal] = useState({ show: false, asset: null, actionTaken: '', condition: 'BAIK', saving: false });
    const [showSPKModal, setShowSPKModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Estimation Schedule States
    const [showEstimationModal, setShowEstimationModal] = useState(false);
    const [estimatedStartDate, setEstimatedStartDate] = useState('');
    const [estimatedCompletionDate, setEstimatedCompletionDate] = useState('');
    const [estimationNote, setEstimationNote] = useState('');
    const [savingEstimation, setSavingEstimation] = useState(false);

    // Form States for Workflow Actions
    const [actionNote, setActionNote] = useState('');
    const [assignUnitId, setAssignUnitId] = useState('');
    const [technicianName, setTechnicianName] = useState('');
    const [technicianPhone, setTechnicianPhone] = useState('');
    const [technicianId, setTechnicianId] = useState(null);
    const [progressPercentage, setProgressPercentage] = useState(50);
    const [technicianType, setTechnicianType] = useState('internal');
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [createWorkshopOrder, setCreateWorkshopOrder] = useState(false);
    const [progressNote, setProgressNote] = useState('');
    const [costItems, setCostItems] = useState([]);
    const [receiptFile, setReceiptFile] = useState(null);
    const [completionPhoto, setCompletionPhoto] = useState(null);

    // Multi-Asset Action States
    const [actionMode, setActionMode] = useState('ALL');
    const [bulkAllCondition, setBulkAllCondition] = useState('');
    const [assetActionItems, setAssetActionItems] = useState([]);
    const [bulkSelectedAction, setBulkSelectedAction] = useState('');
    const [bulkSelectedCondition, setBulkSelectedCondition] = useState('');

    // Global Toast State
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
    };

    // --- Data Fetching ---
    const fetchReport = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/maintenance/${id}`);
            setReport(res.data);
            if (res.data?.aiDiagnosis) {
                if (res.data.aiDiagnosis.estimatedStartDate) {
                    setEstimatedStartDate(dayjs(res.data.aiDiagnosis.estimatedStartDate).format('YYYY-MM-DDTHH:mm'));
                }
                if (res.data.aiDiagnosis.estimatedCompletionDate) {
                    setEstimatedCompletionDate(dayjs(res.data.aiDiagnosis.estimatedCompletionDate).format('YYYY-MM-DD'));
                }
                if (res.data.aiDiagnosis.estimationNote) {
                    setEstimationNote(res.data.aiDiagnosis.estimationNote);
                }
            }
        } catch (err) {
            console.error("Failed to fetch maintenance report:", err);
            showToast('Gagal memuat detail laporan', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await api.get('/users');
            setUsers((res.data || []).map(u => ({
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

    // --- AI Diagnosis Handler ---
    const handleDiagnoseAI = async () => {
        try {
            setAiLoading(true);
            const res = await api.post(`/maintenance/${id}/ai-diagnose`);
            showToast('Analisis diagnosis AI berhasil disusun!');
            fetchReport();
        } catch (err) {
            console.error("AI diagnosis error:", err);
            showToast(err.response?.data?.error || 'Gagal menjalankan analisis AI', 'error');
        } finally {
            setAiLoading(false);
        }
    };

    const handleApplyAIRecommendation = (actions) => {
        if (!Array.isArray(actions) || actions.length === 0) return;
        const text = actions.map((act, i) => `${i + 1}. ${act}`).join('\n');
        setProgressNote(prev => prev ? `${prev}\n\n[Rekomendasi AI]:\n${text}` : `[Rekomendasi AI]:\n${text}`);
        
        // If report is in progress, automatically open progress/completion modal
        if (report?.status === 'IN_PROGRESS') {
            handleOpenActionModal('progress', 'IN_PROGRESS');
        }
        showToast('Rekomendasi AI disalin ke formulir tindakan teknisi!');
    };

    // --- Media Handler ---
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

    // --- Discussion / Chat Handler ---
    const handleSendChat = async (message) => {
        try {
            setSendingChat(true);
            await api.post(`/maintenance/${id}/progress`, { message });
            showToast('Pesan berhasil dikirim!');
            fetchReport();
        } catch (err) {
            showToast(err.response?.data?.error || 'Gagal mengirim pesan', 'error');
        } finally {
            setSendingChat(false);
        }
    };

    // --- Asset History Handler ---
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

    // --- Single Asset Action Modal Handlers ---
    const handleOpenSingleAssetModal = (asset) => {
        const existingMeta = Array.isArray(report?.aiDiagnosis?.assetActions) ? report.aiDiagnosis.assetActions : [];
        const existing = existingMeta.find(e => parseInt(e.assetId) === asset.id) || {};
        setSingleAssetModal({
            show: true,
            asset,
            actionTaken: existing.actionTaken || '',
            condition: existing.condition || asset.condition || 'BAIK',
            saving: false
        });
    };

    const handleSaveSingleAssetAction = async () => {
        if (!singleAssetModal.asset) return;
        try {
            setSingleAssetModal(prev => ({ ...prev, saving: true }));
            await api.put(`/maintenance/${id}/complete-asset/${singleAssetModal.asset.id}`, {
                actionTaken: singleAssetModal.actionTaken,
                condition: singleAssetModal.condition
            });
            showToast(`Tindakan untuk ${singleAssetModal.asset.code} berhasil disimpan!`);
            setSingleAssetModal({ show: false, asset: null, actionTaken: '', condition: 'BAIK', saving: false });
            fetchReport();
        } catch (err) {
            showToast(err.response?.data?.error || 'Gagal menyimpan tindakan aset', 'error');
            setSingleAssetModal(prev => ({ ...prev, saving: false }));
        }
    };

    // --- Multi-Asset Selection Helpers ---
    const handleToggleSelectAllAssets = (checked) => {
        setAssetActionItems(prev => prev.map(item => ({ ...item, selected: checked })));
    };

    const handleApplyToSelectedAssets = () => {
        const hasSelected = assetActionItems.some(i => i.selected);
        if (!hasSelected) {
            showToast('Silakan centang setidaknya satu aset terlebih dahulu', 'error');
            return;
        }
        if (!bulkSelectedAction.trim() && !bulkSelectedCondition) {
            showToast('Isi tindakan atau pilih kondisi untuk diterapkan ke aset yang dicentang', 'error');
            return;
        }
        setAssetActionItems(prev => prev.map(item => {
            if (!item.selected) return item;
            return {
                ...item,
                actionTaken: bulkSelectedAction.trim() ? bulkSelectedAction.trim() : item.actionTaken,
                condition: bulkSelectedCondition ? bulkSelectedCondition : item.condition
            };
        }));
        showToast('Berhasil diterapkan ke aset yang dicentang!');
    };

    // --- Action Modal Handlers ---
    const handleOpenActionModal = (type, nextStatus) => {
        setActionModal({ show: true, type, nextStatus });
        if (type === 'start') {
            if (!estimatedStartDate) {
                setEstimatedStartDate(report?.aiDiagnosis?.estimatedStartDate 
                    ? dayjs(report.aiDiagnosis.estimatedStartDate).format('YYYY-MM-DDTHH:mm') 
                    : dayjs().format('YYYY-MM-DDTHH:mm'));
            }
            if (!estimatedCompletionDate) {
                setEstimatedCompletionDate(report?.aiDiagnosis?.estimatedCompletionDate 
                    ? dayjs(report.aiDiagnosis.estimatedCompletionDate).format('YYYY-MM-DD') 
                    : dayjs().add(1, 'day').format('YYYY-MM-DD'));
            }
        }
        if (type === 'assignment') {
            setTechnicianName(report?.technician || '');
            setTechnicianPhone(report?.technicianPhone || '');
            setTechnicianId(report?.aiDiagnosis?.technicianId || null);
            setUserSearchQuery('');
            setAssignUnitId('');
        }
        if (type === 'completion' || type === 'progress') {
            setProgressPercentage(type === 'completion' ? 100 : (report?.aiDiagnosis?.progressPercentage || 50));
            setActionMode('ALL');
            setBulkAllCondition(type === 'completion' ? 'BAIK' : '');
            setBulkSelectedAction('');
            setBulkSelectedCondition('');

            const existingMeta = Array.isArray(report?.aiDiagnosis?.assetActions) ? report.aiDiagnosis.assetActions : [];
            const completedList = Array.isArray(report?.aiDiagnosis?.completedAssets) ? report.aiDiagnosis.completedAssets : [];

            const initialItems = (report?.assets || []).map(a => {
                const existing = existingMeta.find(e => parseInt(e.assetId) === a.id) || {};
                return {
                    assetId: a.id,
                    code: a.code,
                    name: a.name,
                    actionTaken: existing.actionTaken || '',
                    condition: existing.condition || a.condition || 'BAIK',
                    isCompleted: completedList.includes(a.id) || (type === 'completion'),
                    selected: false
                };
            });
            setAssetActionItems(initialItems);
        }
    };

    const handleCloseActionModal = () => {
        setActionModal({ show: false, type: '', nextStatus: '' });
        setActionNote('');
        setAssignUnitId('');
        setTechnicianName('');
        setTechnicianPhone('');
        setTechnicianId(null);
        setProgressPercentage(50);
        setUserSearchQuery('');
        setProgressNote('');
        setCostItems([]);
        setReceiptFile(null);
        setCompletionPhoto(null);
        setActionMode('ALL');
        setBulkAllCondition('');
        setAssetActionItems([]);
        setBulkSelectedAction('');
        setBulkSelectedCondition('');
    };

    const handleStatusUpdate = async () => {
        if (submitting) return;
        setSubmitting(true);
        try {
            const payload = { status: actionModal.nextStatus };

            if (actionModal.nextStatus === 'APPROVED') payload.approvalNote = actionNote;
            if (actionModal.nextStatus === 'VALIDATED') payload.validationNote = actionNote;
            if (actionModal.nextStatus === 'REJECTED') payload.rejectionReason = actionNote;
            if (actionModal.nextStatus === 'ASSIGNED') {
                if (!technicianName || !technicianName.trim()) {
                    showToast('Silakan cari dan pilih teknisi terlebih dahulu!', 'error');
                    return;
                }
                payload.technician = technicianName.trim();
                payload.technicianId = technicianId;
                payload.technicianPhone = technicianPhone ? technicianPhone.trim() : undefined;
                payload.approvalNote = actionNote;
            }

            if (actionModal.type === 'start' || estimatedStartDate || estimatedCompletionDate) {
                if (estimatedStartDate) payload.estimatedStartDate = estimatedStartDate;
                if (estimatedCompletionDate) payload.estimatedCompletionDate = estimatedCompletionDate;
                if (estimationNote) payload.estimationNote = estimationNote;
            }

            if (actionModal.type === 'completion' || actionModal.type === 'progress') {
                payload.progressPercentage = actionModal.type === 'completion' ? 100 : progressPercentage;
                const now = new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

                if (report?.assets && report.assets.length > 0) {
                    if (actionMode === 'PER_ASSET') {
                        payload.assetActions = assetActionItems.map(item => ({
                            assetId: item.assetId,
                            actionTaken: item.actionTaken ? item.actionTaken.trim() : '',
                            condition: item.condition,
                            isCompleted: item.isCompleted
                        }));

                        const bulletLines = assetActionItems
                            .filter(item => item.actionTaken && item.actionTaken.trim())
                            .map(item => `• ${item.code} (${item.name}): ${item.actionTaken.trim()}${item.condition ? ` [Kondisi: ${item.condition}]` : ''}`)
                            .join('\n');

                        const combinedDetails = [
                            bulletLines,
                            progressNote.trim() ? `Catatan Umum: ${progressNote.trim()}` : ''
                        ].filter(Boolean).join('\n');

                        const newLog = `[${now}]\n${combinedDetails || (progressNote.trim() || 'Pembaruan tindakan aset')}`;
                        payload.actionTaken = report.actionTaken ? `${report.actionTaken}\n\n${newLog}` : newLog;
                    } else {
                        payload.assetActions = report.assets.map(a => ({
                            assetId: a.id,
                            actionTaken: progressNote.trim(),
                            condition: bulkAllCondition || undefined,
                            isCompleted: actionModal.type === 'completion'
                        }));

                        const conditionNote = bulkAllCondition ? ` [Kondisi Semua: ${bulkAllCondition}]` : '';
                        const newLog = `[${now}] ${progressNote.trim()}${conditionNote}`;
                        payload.actionTaken = report.actionTaken ? `${report.actionTaken}\n\n${newLog}` : newLog;
                    }
                } else {
                    if (progressNote.trim()) {
                        const newLog = `[${now}] ${progressNote.trim()}`;
                        payload.actionTaken = report.actionTaken ? `${report.actionTaken}\n\n${newLog}` : newLog;
                    } else {
                        payload.actionTaken = report.actionTaken || undefined;
                    }
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

            handleCloseActionModal();
            showToast('Status berhasil diperbarui!');
            fetchReport();
        } catch (error) {
            console.error(error);
            showToast(error.response?.data?.error || 'Gagal memperbarui status', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // Save estimation directly from estimation modal
    const handleSaveEstimation = async (estimationData) => {
        try {
            setSavingEstimation(true);
            await api.put(`/maintenance/${id}/status`, {
                status: report.status,
                estimatedStartDate: estimationData.estimatedStartDate,
                estimatedCompletionDate: estimationData.estimatedCompletionDate,
                estimationNote: estimationData.estimationNote
            });
            showToast('Estimasi pengerjaan berhasil disimpan!');
            setShowEstimationModal(false);
            fetchReport();
        } catch (err) {
            console.error('Failed to save estimation:', err);
            showToast(err.response?.data?.error || 'Gagal menyimpan estimasi pengerjaan', 'error');
        } finally {
            setSavingEstimation(false);
        }
    };

    if (loading) return <div className="p-10 text-center text-slate-400">Memuat...</div>;
    if (!report) return <div className="p-10 text-center text-slate-400">Laporan tidak ditemukan.</div>;

    const isRejected = report.status === 'REJECTED';
    const isAssignedTechnician = Boolean(
        (report?.aiDiagnosis?.technicianId && user?.id && parseInt(report.aiDiagnosis.technicianId) === parseInt(user.id)) ||
        (report?.technicianId && user?.id && parseInt(report.technicianId) === parseInt(user.id)) ||
        (report?.technician && (
            (user?.name && report.technician.trim().toLowerCase() === user.name.trim().toLowerCase()) ||
            (user?.username && report.technician.trim().toLowerCase() === user.username.trim().toLowerCase()) ||
            (user?.name && report.technician.toLowerCase().includes(user.name.trim().toLowerCase())) ||
            (user?.username && report.technician.toLowerCase().includes(user.username.trim().toLowerCase())) ||
            (user?.name && user.name.toLowerCase().includes(report.technician.trim().toLowerCase())) ||
            (user?.username && user.username.toLowerCase().includes(report.technician.trim().toLowerCase()))
        ))
    );

    const getNextAction = () => {
        if (isRejected) return null;

        // User yang ditugaskan (atau Admin) pada status ASSIGNED atau IN_PROGRESS
        if (report.status === 'ASSIGNED' && (isAdmin || isAssignedTechnician)) {
            return {
                label: 'Mulai Pengerjaan',
                nextStatus: 'IN_PROGRESS',
                type: 'start',
                secondaryLabel: 'Selesaikan Pekerjaan',
                secondaryType: 'completion',
                secondaryNextStatus: 'COMPLETED',
                cancelLabel: isAdmin ? 'Batalkan Laporan' : null
            };
        }

        if (report.status === 'IN_PROGRESS' && (isAdmin || isAssignedTechnician)) {
            return {
                label: 'Selesaikan Pekerjaan',
                nextStatus: 'COMPLETED',
                type: 'completion',
                secondaryLabel: 'Update Progres',
                secondaryType: 'progress',
                secondaryNextStatus: 'IN_PROGRESS',
                cancelLabel: isAdmin ? 'Batalkan Laporan' : null
            };
        }

        if (!isAdmin) return null;
        const transitions = {
            'SUBMITTED': { label: 'Setujui & Tugaskan', nextStatus: 'ASSIGNED', type: 'assignment', rejectLabel: 'Tolak' },
            'APPROVED': { label: 'Tugaskan Teknisi', nextStatus: 'ASSIGNED', type: 'assignment', cancelLabel: 'Batalkan Laporan' }
        };
        return transitions[report.status] || null;
    };

    const nextAction = getNextAction();

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

            {/* Header & Progress Tracker */}
            <MaintenanceHeader 
                report={report} 
                onBack={() => navigate('/pemeliharaan')} 
                onOpenSPK={() => setShowSPKModal(true)} 
            />

            {/* Banner Khusus Teknisi / User yang Ditugaskan */}
            {isAssignedTechnician && ['ASSIGNED', 'IN_PROGRESS'].includes(report.status) && (
                <div className="bg-gradient-to-r from-blue-500/10 via-emerald-500/10 to-blue-500/10 border border-blue-200/80 rounded-2xl p-4 flex flex-col gap-3 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                                <Wrench size={18} />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                                    <span>Anda Ditugaskan pada Laporan Ini</span>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                        report.status === 'ASSIGNED' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-blue-100 text-blue-700 border border-blue-200'
                                    }`}>
                                        {report.status === 'ASSIGNED' ? 'Menunggu Dimulai' : 'Sedang Dikerjakan'}
                                    </span>
                                </h4>
                                <p className="text-xs text-slate-600 mt-0.5">
                                    {report.status === 'ASSIGNED'
                                        ? 'Silakan tentukan estimasi waktu pengerjaan dan mulai perbaikan ketika sudah siap.'
                                        : 'Pekerjaan perbaikan sedang berjalan. Anda dapat memperbarui progres atau menyelesaikan pekerjaan.'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            {report.status === 'ASSIGNED' ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setShowEstimationModal(true)}
                                        className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                                        title="Atur perkiraan mulai dan selesai"
                                    >
                                        <CalendarClock size={14} /> Atur Estimasi
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleOpenActionModal('start', 'IN_PROGRESS')}
                                        className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <CheckCircle size={14} /> Mulai Pengerjaan
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleOpenActionModal('completion', 'COMPLETED')}
                                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <CheckCircle size={14} /> Selesaikan
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setShowEstimationModal(true)}
                                        className="px-3.5 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <CalendarClock size={14} /> Jadwal Estimasi
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleOpenActionModal('progress', 'IN_PROGRESS')}
                                        className="px-3.5 py-2 bg-white border border-orange-400 text-orange-600 hover:bg-orange-50 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <Sparkles size={14} /> Update Progres
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleOpenActionModal('completion', 'COMPLETED')}
                                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <CheckCircle size={14} /> Selesaikan
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Banner Card Status Estimasi */}
                    {report.aiDiagnosis?.estimatedStartDate && report.aiDiagnosis?.estimatedCompletionDate ? (
                        <div className="pt-2.5 border-t border-blue-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white/80 p-3 rounded-xl border border-blue-100">
                            <div className="flex items-center gap-2.5">
                                <CalendarClock size={18} className="text-blue-600 shrink-0" />
                                <div className="text-xs">
                                    <div className="font-extrabold text-slate-800">
                                        Estimasi Pengerjaan: <span className="text-blue-700">{dayjs(report.aiDiagnosis.estimatedStartDate).format('D MMMM YYYY, HH:mm')}</span> s/d <span className="text-blue-700">{dayjs(report.aiDiagnosis.estimatedCompletionDate).format('D MMMM YYYY')}</span>
                                    </div>
                                    {report.aiDiagnosis.estimationNote && (
                                        <p className="text-[11px] text-slate-500 italic mt-0.5">"{report.aiDiagnosis.estimationNote}"</p>
                                    )}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowEstimationModal(true)}
                                className="px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors shrink-0 cursor-pointer"
                            >
                                Ubah Estimasi
                            </button>
                        </div>
                    ) : (
                        <div className="pt-2.5 border-t border-amber-300/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50/90 p-3 rounded-xl border border-amber-200 animate-in fade-in">
                            <div className="flex items-start gap-2.5">
                                <CalendarClock size={18} className="text-amber-600 shrink-0 mt-0.5" />
                                <div className="text-xs text-amber-900">
                                    <div className="font-extrabold">Harap Atur Estimasi Mulai & Selesai</div>
                                    <p className="text-[11px] text-amber-800 mt-0.5">
                                        Sebagai teknisi internal yang ditugaskan, Anda diminta menetapkan perkiraan jadwal pengerjaan ini.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowEstimationModal(true)}
                                className="px-3 py-1.5 text-xs font-black text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-all shadow-xs shrink-0 flex items-center gap-1.5 cursor-pointer"
                            >
                                <CalendarClock size={13} /> Atur Sekarang
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* AI Diagnosis & Smart Troubleshooting Card */}
            <MaintenanceAIDiagnosisCard 
                report={report} 
                onDiagnose={handleDiagnoseAI} 
                loading={aiLoading} 
                onApplyRecommendation={handleApplyAIRecommendation}
            />

            {/* Info Cards (Laporan, Pelapor, Multi-Aset List) */}
            <MaintenanceInfoCards 
                report={report} 
                onOpenSingleAssetModal={handleOpenSingleAssetModal} 
                onFetchAssetHistory={fetchAssetHistory} 
                onOpenEstimationModal={() => setShowEstimationModal(true)}
                isAssignedTechnician={isAssignedTechnician}
                isAdmin={isAdmin}
            />

            {/* Media Gallery & Documentation */}
            <MaintenanceMediaGallery 
                report={report} 
                isAdmin={isAdmin} 
                isAssignedTechnician={isAssignedTechnician}
                currentUserId={user?.id} 
                onAddMedia={handleAddMedia} 
                uploadingMedia={uploadingMedia} 
            />

            {/* Action Taken Log & Costs Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {report.actionTaken && (
                    <div className="bg-emerald-50/60 rounded-2xl border border-emerald-200 p-5 space-y-2">
                        <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                            <Wrench size={14} /> Riwayat & Tindakan Perbaikan
                        </h3>
                        <div className="text-xs text-emerald-900 whitespace-pre-wrap font-mono leading-relaxed bg-white/80 p-3 rounded-xl border border-emerald-100 max-h-48 overflow-y-auto">
                            {report.actionTaken}
                        </div>
                    </div>
                )}

                {(report.cost > 0 || report.status === 'COMPLETED') && (
                    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-3">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-200/80">
                            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Rincian Biaya</h3>
                            <span className="font-extrabold text-slate-800 text-base">
                                Rp {report.cost.toLocaleString('id-ID')}
                            </span>
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
                                        <span className="font-bold text-slate-700">
                                            Rp {item.price?.toLocaleString('id-ID')}
                                        </span>
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

            {/* Workflow Action Buttons */}
            {nextAction && (
                <div className="flex flex-col md:flex-row gap-3">
                    <button
                        onClick={() => handleOpenActionModal(nextAction.type, nextAction.nextStatus)}
                        className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer"
                    >
                        <CheckCircle size={16} /> {nextAction.label}
                    </button>

                    {nextAction.secondaryLabel && (
                        <button
                            onClick={() => handleOpenActionModal(nextAction.secondaryType, nextAction.secondaryNextStatus || report.status)}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-md ${
                                nextAction.secondaryType === 'completion'
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                    : 'bg-white border-2 border-orange-500 text-orange-600 hover:bg-orange-50'
                            }`}
                        >
                            {nextAction.secondaryType === 'completion' ? <CheckCircle size={16} /> : <Sparkles size={16} />}
                            {nextAction.secondaryLabel}
                        </button>
                    )}

                    {nextAction.rejectLabel && (
                        <button
                            onClick={() => handleOpenActionModal('rejection', 'REJECTED')}
                            className="flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer"
                        >
                            <XCircle size={16} /> {nextAction.rejectLabel}
                        </button>
                    )}
                    {nextAction.cancelLabel && isAdmin && (
                        <button
                            onClick={() => handleOpenActionModal('rejection', 'REJECTED')}
                            className="flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer"
                        >
                            <XCircle size={16} /> {nextAction.cancelLabel}
                        </button>
                    )}
                </div>
            )}

            {/* Edit Biaya Button for Completed Reports */}
            {!nextAction && report.status === 'COMPLETED' && (isAdmin || isAssignedTechnician) && (
                <button
                    onClick={() => {
                        setCostItems(report.costDetails || []);
                        setProgressNote('');
                        setActionNote(report.completionNote || '');
                        setActionModal({ show: true, type: 'completion', nextStatus: 'COMPLETED' });
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white py-3.5 rounded-xl font-bold text-xs shadow-md transition-all uppercase tracking-wider cursor-pointer"
                >
                    <Edit2 size={15} /> Edit Rincian Biaya & Nota Pembayaran
                </button>
            )}

            {/* Realtime Discussion / Chat Box */}
            <MaintenanceDiscussion 
                report={report} 
                users={users} 
                currentUserId={user?.id} 
                onSendChat={handleSendChat} 
                sendingChat={sendingChat} 
            />

            {/* Modals */}
            <MaintenanceActionModal 
                actionModal={actionModal}
                onClose={handleCloseActionModal}
                onSubmit={handleStatusUpdate}
                submitting={submitting}
                report={report}
                units={units}
                users={users}
                contractors={contractors}
                actionNote={actionNote}
                setActionNote={setActionNote}
                technicianType={technicianType}
                setTechnicianType={setTechnicianType}
                technicianName={technicianName}
                setTechnicianName={setTechnicianName}
                technicianPhone={technicianPhone}
                setTechnicianPhone={setTechnicianPhone}
                technicianId={technicianId}
                setTechnicianId={setTechnicianId}
                progressPercentage={progressPercentage}
                setProgressPercentage={setProgressPercentage}
                userSearchQuery={userSearchQuery}
                setUserSearchQuery={setUserSearchQuery}
                assignUnitId={assignUnitId}
                setAssignUnitId={setAssignUnitId}
                createWorkshopOrder={createWorkshopOrder}
                setCreateWorkshopOrder={setCreateWorkshopOrder}
                progressNote={progressNote}
                setProgressNote={setProgressNote}
                actionMode={actionMode}
                setActionMode={setActionMode}
                bulkAllCondition={bulkAllCondition}
                setBulkAllCondition={setBulkAllCondition}
                assetActionItems={assetActionItems}
                setAssetActionItems={setAssetActionItems}
                bulkSelectedAction={bulkSelectedAction}
                setBulkSelectedAction={setBulkSelectedAction}
                bulkSelectedCondition={bulkSelectedCondition}
                setBulkSelectedCondition={setBulkSelectedCondition}
                costItems={costItems}
                setCostItems={setCostItems}
                setReceiptFile={setReceiptFile}
                setCompletionPhoto={setCompletionPhoto}
                onToggleSelectAllAssets={handleToggleSelectAllAssets}
                onApplyToSelectedAssets={handleApplyToSelectedAssets}
                estimatedStartDate={estimatedStartDate}
                setEstimatedStartDate={setEstimatedStartDate}
                estimatedCompletionDate={estimatedCompletionDate}
                setEstimatedCompletionDate={setEstimatedCompletionDate}
                estimationNote={estimationNote}
                setEstimationNote={setEstimationNote}
            />

            <MaintenanceEstimationModal 
                show={showEstimationModal}
                onClose={() => setShowEstimationModal(false)}
                onSave={handleSaveEstimation}
                saving={savingEstimation}
                report={report}
                initialStartDate={estimatedStartDate}
                initialCompletionDate={estimatedCompletionDate}
                initialNote={estimationNote}
            />

            <MaintenanceSingleAssetModal 
                modalState={singleAssetModal}
                onClose={() => setSingleAssetModal({ show: false, asset: null, actionTaken: '', condition: 'BAIK', saving: false })}
                onSave={handleSaveSingleAssetAction}
                onChangeAction={val => setSingleAssetModal(prev => ({ ...prev, actionTaken: val }))}
                onChangeCondition={val => setSingleAssetModal(prev => ({ ...prev, condition: val }))}
            />

            <MaintenanceSPKModal 
                show={showSPKModal}
                onClose={() => setShowSPKModal(false)}
                report={report}
                currentUser={user}
                onReportUpdated={fetchReport}
            />

            <MaintenanceAssetHistoryModal 
                historyModal={historyModal}
                onClose={() => setHistoryModal({ show: false, asset: null, timeline: [], loading: false })}
            />
        </div>
    );
};

export default MaintenanceDetail;
