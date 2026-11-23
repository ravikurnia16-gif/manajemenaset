import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Bot, Sparkles, ClipboardCheck, FileText, CheckCircle2, XCircle,
    Play, Settings, Download, History, Plus, RefreshCw, Edit3, Send,
    ShieldAlert, Copy, Trash2, Search, Eye, Save, X, Check
} from 'lucide-react';
import api from '../../lib/axios';

const CATEGORY_BADGE = {
    LAPORAN_HARIAN: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    SOP: 'bg-blue-100 text-blue-800 border-blue-200',
    ATURAN: 'bg-amber-100 text-amber-800 border-amber-200',
    SURAT: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    LAINNYA: 'bg-slate-100 text-slate-700 border-slate-200'
};

const PRIORITY_BADGE = {
    URGENT: 'bg-rose-100 text-rose-700 border-rose-200',
    HIGH: 'bg-orange-100 text-orange-700 border-orange-200',
    NORMAL: 'bg-slate-100 text-slate-600 border-slate-200',
    LOW: 'bg-slate-50 text-slate-500 border-slate-200'
};

const STATUS_LABEL = {
    PROPOSED: 'Menunggu ACC',
    APPROVED_FOR_DRAFT: 'Di-ACC (Antre Draft)',
    DRAFTING: 'Sedang Disusun',
    DRAFT_READY: 'Draft Siap (Internal)',
    FINALIZED: 'Final (Internal Kantor AI)',
    REJECTED: 'Ditolak'
};

const DOMAIN_OPTIONS = ['Umum', 'Aset', 'Kendaraan', 'Pemeliharaan', 'Workshop', 'Gudang', 'Pengadaan', 'CCTV', 'Personalia'];

function MarkdownDocumentPreview({ content }) {
    const lines = useMemo(() => String(content || '').split(/\r?\n/), [content]);

    const formatInline = (text) =>
        text
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/__(.*?)__/g, '$1')
            .replace(/`([^`]+)`/g, '$1');

    if (!content) {
        return <p className="text-sm text-slate-400 italic">Belum ada isi dokumen.</p>;
    }

    return (
        <div className="space-y-1.5 text-sm text-slate-700 leading-relaxed">
            {lines.map((rawLine, idx) => {
                const line = rawLine.trim();
                if (!line) return <div key={idx} className="h-2" />;
                if (line === '---' || line === '***') {
                    return <hr key={idx} className="border-slate-200 my-3" />;
                }
                if (line.startsWith('# ')) {
                    return (
                        <h2 key={idx} className="text-base font-black text-slate-900 pt-2 pb-1 border-b border-slate-200">
                            {formatInline(line.slice(2))}
                        </h2>
                    );
                }
                if (line.startsWith('## ')) {
                    return (
                        <h3 key={idx} className="text-sm font-extrabold text-blue-900 pt-3">
                            {formatInline(line.slice(3))}
                        </h3>
                    );
                }
                if (line.startsWith('### ')) {
                    return (
                        <h4 key={idx} className="text-xs font-bold uppercase tracking-wide text-slate-700 pt-2">
                            {formatInline(line.slice(4))}
                        </h4>
                    );
                }
                if (/^[-*]\s+/.test(line)) {
                    return (
                        <div key={idx} className="flex gap-2 pl-2">
                            <span className="text-blue-500 font-bold">•</span>
                            <span>{formatInline(line.replace(/^[-*]\s+/, ''))}</span>
                        </div>
                    );
                }
                if (/^\d+\.\s+/.test(line)) {
                    const match = line.match(/^(\d+\.)\s+(.*)$/);
                    return (
                        <div key={idx} className="flex gap-2 pl-2">
                            <span className="font-bold text-slate-800 shrink-0">{match?.[1]}</span>
                            <span>{formatInline(match?.[2] || line)}</span>
                        </div>
                    );
                }
                return <p key={idx}>{formatInline(line)}</p>;
            })}
        </div>
    );
}

export default function AiOfficePage() {
    const [activeTab, setActiveTab] = useState('ACC_QUEUE'); // ACC_QUEUE | REPORTS | DRAFTS | SETTINGS | LOGS
    const [dashboard, setDashboard] = useState(null);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busyAction, setBusyAction] = useState('');
    const [toast, setToast] = useState(null);

    // Filters for Drafts & Archives
    const [draftCategoryFilter, setDraftCategoryFilter] = useState('ALL');
    const [draftStatusFilter, setDraftStatusFilter] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    // Edit brief/title inline before ACC
    const [editingProposalId, setEditingProposalId] = useState(null);
    const [proposalEdits, setProposalEdits] = useState({ title: '', brief: '', priority: 'NORMAL' });

    // Modal: Request Custom Document / Propose Topic
    const [showProposeTopicModal, setShowProposeTopicModal] = useState(false);
    const [proposeForm, setProposeForm] = useState({ count: 4, category: 'ALL', focusTopic: '' });

    const [showManualModal, setShowManualModal] = useState(false);
    const [manualForm, setManualForm] = useState({
        title: '',
        category: 'SOP',
        domain: 'Umum',
        priority: 'HIGH',
        rationale: '',
        brief: '',
        autoApprove: true,
        draftNow: true
    });

    // Modal: Document Reader / Editor / AI Revision
    const [selectedDoc, setSelectedDoc] = useState(null);
    const [isEditingDoc, setIsEditingDoc] = useState(false);
    const [docEditForm, setDocEditForm] = useState({ title: '', content: '' });
    const [revisionPrompt, setRevisionPrompt] = useState('');

    // Settings Form
    const [configForm, setConfigForm] = useState({
        isEnabled: true,
        supervisorName: 'Staf Supervisi AI',
        adminStaffName: 'Staf Administrasi AI',
        dailyScheduleHour: 7,
        dailyScheduleMinute: 30,
        eveningScheduleHour: 16,
        maxDailyDrafts: 2,
        sopGeneralFormat: '',
        policyGuidelines: ''
    });

    const showNotice = useCallback((text, type = 'success') => {
        setToast({ text, type });
        setTimeout(() => setToast(null), 4000);
    }, []);

    const fetchAllData = useCallback(async () => {
        try {
            setLoading(true);
            const [dashRes, itemsRes] = await Promise.all([
                api.get('/ai-office/dashboard'),
                api.get('/ai-office/items')
            ]);
            setDashboard(dashRes.data);
            setItems(Array.isArray(itemsRes.data) ? itemsRes.data : []);
            if (dashRes.data?.config) {
                const c = dashRes.data.config;
                setConfigForm({
                    isEnabled: Boolean(c.isEnabled),
                    supervisorName: c.supervisorName || 'Staf Supervisi AI',
                    adminStaffName: c.adminStaffName || 'Staf Administrasi AI',
                    dailyScheduleHour: c.dailyScheduleHour ?? 7,
                    dailyScheduleMinute: c.dailyScheduleMinute ?? 30,
                    eveningScheduleHour: c.eveningScheduleHour ?? 16,
                    maxDailyDrafts: c.maxDailyDrafts ?? 2,
                    sopGeneralFormat: c.sopGeneralFormat || '',
                    policyGuidelines: c.policyGuidelines || ''
                });
            }
            window.dispatchEvent(new Event('aiOfficeChanged'));
        } catch (err) {
            showNotice(err.response?.data?.error || 'Gagal memuat data Kantor AI', 'error');
        } finally {
            setLoading(false);
        }
    }, [showNotice]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    const proposedItems = useMemo(
        () => items.filter(i => i.staffRole === 'ADMINISTRASI' && i.status === 'PROPOSED'),
        [items]
    );

    const approvedQueueItems = useMemo(
        () => items.filter(i => i.staffRole === 'ADMINISTRASI' && ['APPROVED_FOR_DRAFT', 'DRAFTING'].includes(i.status)),
        [items]
    );

    const supervisorReports = useMemo(
        () => items.filter(i => i.staffRole === 'SUPERVISI' && i.category === 'LAPORAN_HARIAN'),
        [items]
    );

    const adminDrafts = useMemo(() => {
        return items.filter(i => {
            if (i.staffRole !== 'ADMINISTRASI') return false;
            if (!['DRAFT_READY', 'FINALIZED'].includes(i.status)) return false;
            if (draftCategoryFilter !== 'ALL' && i.category !== draftCategoryFilter) return false;
            if (draftStatusFilter !== 'ALL' && i.status !== draftStatusFilter) return false;
            if (searchTerm.trim()) {
                const q = searchTerm.toLowerCase();
                const hit =
                    (i.title || '').toLowerCase().includes(q) ||
                    (i.code || '').toLowerCase().includes(q) ||
                    (i.domain || '').toLowerCase().includes(q);
                if (!hit) return false;
            }
            return true;
        });
    }, [items, draftCategoryFilter, draftStatusFilter, searchTerm]);

    const handleRunSupervisor = async () => {
        try {
            setBusyAction('supervisor');
            const res = await api.post('/ai-office/run/supervisor', { force: true });
            showNotice(
                res.data?.usedFallback
                    ? 'Laporan Supervisi Harian dibuat (mode ringkasan terstruktur).'
                    : 'Staf Supervisi AI selesai menyusun Laporan Harian Kepala Bidang Sarana!'
            );
            await fetchAllData();
            setActiveTab('REPORTS');
        } catch (err) {
            showNotice(err.response?.data?.error || 'Gagal menjalankan Staf Supervisi AI', 'error');
        } finally {
            setBusyAction('');
        }
    };

    const handleRunDailyShift = async () => {
        try {
            setBusyAction('daily');
            const res = await api.post('/ai-office/run/daily', { force: true });
            const d = res.data || {};
            showNotice(
                `Shift Kantor AI selesai: ${d.supervisorCreated ? '1 laporan supervisi, ' : ''}${d.draftedCount || 0} draft disusun, ${d.proposedCreated || 0} usulan baru.`
            );
            await fetchAllData();
        } catch (err) {
            showNotice(err.response?.data?.error || 'Gagal menjalankan shift harian Kantor AI', 'error');
        } finally {
            setBusyAction('');
        }
    };

    const handleProposeBacklog = async (e) => {
        e.preventDefault();
        try {
            setBusyAction('propose');
            const res = await api.post('/ai-office/run/propose', proposeForm);
            setShowProposeTopicModal(false);
            setProposeForm({ count: 4, category: 'ALL', focusTopic: '' });
            showNotice(`Staf Administrasi AI mengajukan ${res.data?.items?.length || 0} usulan ke Antrean ACC.`);
            await fetchAllData();
            setActiveTab('ACC_QUEUE');
        } catch (err) {
            showNotice(err.response?.data?.error || 'Gagal membuat daftar usulan', 'error');
        } finally {
            setBusyAction('');
        }
    };

    const handleCreateManualItem = async (e) => {
        e.preventDefault();
        try {
            setBusyAction('manual');
            const res = await api.post('/ai-office/items', manualForm);
            setShowManualModal(false);
            setManualForm({
                title: '',
                category: 'SOP',
                domain: 'Umum',
                priority: 'HIGH',
                rationale: '',
                brief: '',
                autoApprove: true,
                draftNow: true
            });
            showNotice(
                manualForm.autoApprove && manualForm.draftNow
                    ? 'Dokumen khusus langsung disusun Staf Administrasi AI!'
                    : 'Permintaan dokumen disimpan ke Kantor AI.'
            );
            await fetchAllData();
            if (res.data?.status === 'DRAFT_READY') {
                setSelectedDoc(res.data);
                setActiveTab('DRAFTS');
            }
        } catch (err) {
            showNotice(err.response?.data?.error || 'Gagal membuat permintaan dokumen', 'error');
        } finally {
            setBusyAction('');
        }
    };

    const handleAccItem = async (item, draftNow = false) => {
        try {
            setBusyAction(`acc-${item.id}`);
            const payload = editingProposalId === item.id
                ? { ...proposalEdits, draftNow }
                : { draftNow };
            const res = await api.post(`/ai-office/items/${item.id}/acc`, payload);
            setEditingProposalId(null);
            showNotice(
                draftNow
                    ? `Usulan di-ACC dan draft "${res.data?.title || item.title}" telah selesai disusun!`
                    : 'Usulan di-ACC dan masuk ke Antrean Draft Staf Administrasi AI.'
            );
            await fetchAllData();
            if (draftNow && res.data?.id) {
                setSelectedDoc(res.data);
                setIsEditingDoc(false);
            }
        } catch (err) {
            showNotice(err.response?.data?.error || 'Gagal ACC usulan', 'error');
        } finally {
            setBusyAction('');
        }
    };

    const handleDraftQueueItem = async (item) => {
        try {
            setBusyAction(`draft-${item.id}`);
            const res = await api.post(`/ai-office/items/${item.id}/draft`);
            showNotice(`Draft "${res.data?.item?.title || item.title}" selesai disusun.`);
            await fetchAllData();
            if (res.data?.item) {
                setSelectedDoc(res.data.item);
                setIsEditingDoc(false);
            }
        } catch (err) {
            showNotice(err.response?.data?.error || 'Gagal menyusun draft', 'error');
        } finally {
            setBusyAction('');
        }
    };

    const handleRejectItem = async (item) => {
        if (!window.confirm(`Tolak usulan "${item.title}"?`)) return;
        try {
            setBusyAction(`reject-${item.id}`);
            await api.post(`/ai-office/items/${item.id}/reject`, { reason: 'Ditolak oleh pimpinan' });
            showNotice('Usulan ditolak.');
            await fetchAllData();
        } catch (err) {
            showNotice(err.response?.data?.error || 'Gagal menolak usulan', 'error');
        } finally {
            setBusyAction('');
        }
    };

    const handleSaveDocEdits = async () => {
        if (!selectedDoc) return;
        try {
            setBusyAction('save-doc');
            const res = await api.put(`/ai-office/items/${selectedDoc.id}`, {
                title: docEditForm.title,
                content: docEditForm.content
            });
            setSelectedDoc(res.data);
            setIsEditingDoc(false);
            showNotice('Perubahan naskah disimpan di arsip Kantor AI.');
            await fetchAllData();
        } catch (err) {
            showNotice(err.response?.data?.error || 'Gagal menyimpan perubahan', 'error');
        } finally {
            setBusyAction('');
        }
    };

    const handleReviseWithAi = async () => {
        if (!selectedDoc || !revisionPrompt.trim()) return;
        try {
            setBusyAction('revise-ai');
            const res = await api.post(`/ai-office/items/${selectedDoc.id}/revise`, {
                instruction: revisionPrompt.trim()
            });
            setSelectedDoc(res.data.item);
            setDocEditForm({ title: res.data.item.title, content: res.data.item.content || '' });
            setRevisionPrompt('');
            showNotice('Dokumen berhasil direvisi oleh Staf AI!');
            await fetchAllData();
        } catch (err) {
            showNotice(err.response?.data?.error || 'Gagal merevisi dokumen', 'error');
        } finally {
            setBusyAction('');
        }
    };

    const handleFinalizeDoc = async (item) => {
        try {
            setBusyAction(`finalize-${item.id}`);
            const res = await api.put(`/ai-office/items/${item.id}`, { status: 'FINALIZED' });
            if (selectedDoc?.id === item.id) setSelectedDoc(res.data);
            showNotice('Dokumen ditandai Final di internal Kantor AI.');
            await fetchAllData();
        } catch (err) {
            showNotice(err.response?.data?.error || 'Gagal menandai final', 'error');
        } finally {
            setBusyAction('');
        }
    };

    const handleDeleteDoc = async (item) => {
        if (!window.confirm(`Hapus permanen "${item.title}" dari Kantor AI?`)) return;
        try {
            setBusyAction(`delete-${item.id}`);
            await api.delete(`/ai-office/items/${item.id}`);
            if (selectedDoc?.id === item.id) setSelectedDoc(null);
            showNotice('Dokumen dihapus dari Kantor AI.');
            await fetchAllData();
        } catch (err) {
            showNotice(err.response?.data?.error || 'Gagal menghapus dokumen', 'error');
        } finally {
            setBusyAction('');
        }
    };

    const handleDownloadPdf = async (item) => {
        try {
            setBusyAction(`pdf-${item.id}`);
            const res = await api.get(`/ai-office/items/${item.id}/pdf`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
            const a = document.createElement('a');
            a.href = url;
            a.download = `${String(item.code || `kantor-ai-${item.id}`).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            showNotice(err.response?.data?.error || 'Gagal mengunduh PDF', 'error');
        } finally {
            setBusyAction('');
        }
    };

    const handleSaveConfig = async (e) => {
        e.preventDefault();
        try {
            setBusyAction('save-config');
            await api.put('/ai-office/config', configForm);
            showNotice('Format SOP Umum & pengaturan shift Kantor AI tersimpan!');
            await fetchAllData();
        } catch (err) {
            showNotice(err.response?.data?.error || 'Gagal menyimpan pengaturan', 'error');
        } finally {
            setBusyAction('');
        }
    };

    const openDocumentModal = (item, startEdit = false) => {
        setSelectedDoc(item);
        setIsEditingDoc(startEdit);
        setDocEditForm({ title: item.title || '', content: item.content || '' });
        setRevisionPrompt('');
    };

    const counts = dashboard?.counts || {};
    const logs = dashboard?.recentLogs || [];

    return (
        <div className="p-4 md:p-6 space-y-6 animate-in fade-in duration-300">
            {toast && (
                <div className={`fixed top-5 right-5 z-[70] px-4 py-3 rounded-xl shadow-lg border text-xs font-bold flex items-center gap-2 ${
                    toast.type === 'error'
                        ? 'bg-rose-50 border-rose-200 text-rose-800'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}>
                    {toast.type === 'error' ? <ShieldAlert size={16} /> : <CheckCircle2 size={16} />}
                    <span>{toast.text}</span>
                </div>
            )}

            {/* Header */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                        <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
                            <Bot size={24} />
                        </div>
                        <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">
                            Kantor AI — Bidang Sarana
                        </h1>
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            Workspace Internal (Belum dikirim ke E-Office / Aturan Publik)
                        </span>
                    </div>
                    <p className="text-xs md:text-sm text-slate-500">
                        Dua staf virtual AI bekerja setiap hari menyusun laporan supervisi harian ke Kepala Bidang Sarana serta daftar usulan SOP/Aturan/Surat untuk Anda ACC sebelum dibuatkan draftnya.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setShowManualModal(true)}
                        className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all"
                    >
                        <Plus size={15} /> Minta Dokumen Khusus
                    </button>
                    <button
                        type="button"
                        disabled={Boolean(busyAction)}
                        onClick={handleRunDailyShift}
                        className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50 transition-all"
                    >
                        {busyAction === 'daily' ? <RefreshCw size={15} className="animate-spin" /> : <Play size={15} />}
                        Jalankan Shift Harian Sekarang
                    </button>
                </div>
            </div>

            {/* Staff Overview Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Karyawan Supervisi */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 flex flex-col justify-between gap-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                            <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                <ClipboardCheck size={22} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="font-bold text-slate-800 text-sm">
                                        {configForm.supervisorName}
                                    </h2>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        (counts.todayReports || 0) > 0
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-amber-100 text-amber-700'
                                    }`}>
                                        {(counts.todayReports || 0) > 0 ? 'Laporan Hari Ini Terbit' : 'Belum Laporan Hari Ini'}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-1">
                                    Memantau aset, kendaraan, pemeliharaan, workshop, pengadaan & gudang secara real-time lalu menyusun laporan harian untuk Kepala Bidang Sarana.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 text-xs">
                        <span className="text-slate-400">
                            Shift terakhir:{' '}
                            <strong className="text-slate-600">
                                {dashboard?.config?.lastSupervisorRunAt
                                    ? new Date(dashboard.config.lastSupervisorRunAt).toLocaleString('id-ID')
                                    : 'Belum pernah'}
                            </strong>
                        </span>
                        <button
                            type="button"
                            disabled={Boolean(busyAction)}
                            onClick={handleRunSupervisor}
                            className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold flex items-center gap-1.5 disabled:opacity-50"
                        >
                            {busyAction === 'supervisor' ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />}
                            Buat Laporan Sekarang
                        </button>
                    </div>
                </div>

                {/* Karyawan Administrasi */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 flex flex-col justify-between gap-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                <FileText size={22} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="font-bold text-slate-800 text-sm">
                                        {configForm.adminStaffName}
                                    </h2>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                                        {counts.proposed || 0} Usulan Tunggu ACC
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-1">
                                    Mengusulkan daftar kebutuhan SOP, aturan & surat Bidang Sarana. Draft lengkap hanya disusun setelah Anda ACC dengan mengacu Format SOP Umum.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 text-xs">
                        <div className="flex flex-wrap gap-3 text-slate-500">
                            <span>Antre Draft: <strong className="text-slate-800">{counts.approvedQueue || 0}</strong></span>
                            <span>Draft Siap: <strong className="text-slate-800">{counts.draftReady || 0}</strong></span>
                            <span>Final: <strong className="text-emerald-700">{counts.finalized || 0}</strong></span>
                        </div>
                        <button
                            type="button"
                            disabled={Boolean(busyAction)}
                            onClick={() => setShowProposeTopicModal(true)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold flex items-center gap-1.5 disabled:opacity-50"
                        >
                            <Sparkles size={13} /> Buat List Usulan
                        </button>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-0.5">
                {[
                    { id: 'ACC_QUEUE', label: 'Antrean ACC Usulan', icon: <ClipboardCheck size={15} />, badge: (counts.proposed || 0) + (counts.approvedQueue || 0) },
                    { id: 'REPORTS', label: 'Laporan Supervisi Harian', icon: <Bot size={15} />, badge: supervisorReports.length },
                    { id: 'DRAFTS', label: 'Hasil Draft & Arsip Kantor AI', icon: <FileText size={15} />, badge: (counts.draftReady || 0) + (counts.finalized || 0) },
                    { id: 'SETTINGS', label: 'Format SOP & Pengaturan Staf', icon: <Settings size={15} /> },
                    { id: 'LOGS', label: 'Log Kerja Staf AI', icon: <History size={15} /> }
                ].map(t => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => setActiveTab(t.id)}
                        className={`px-4 py-2.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-all ${
                            activeTab === t.id
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        {t.icon}
                        <span>{t.label}</span>
                        {typeof t.badge === 'number' && t.badge > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700">
                                {t.badge}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center text-slate-400">
                    <RefreshCw className="mx-auto animate-spin mb-2 text-blue-500" size={24} />
                    <p className="text-xs font-semibold">Memuat ruang kerja Kantor AI...</p>
                </div>
            ) : activeTab === 'ACC_QUEUE' ? (
                <div className="space-y-6">
                    {/* Proposed List awaiting ACC */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
                        <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h3 className="font-bold text-slate-800 text-sm">Daftar Usulan Menunggu ACC Pimpinan ({proposedItems.length})</h3>
                                <p className="text-[11px] text-slate-500">
                                    Staf Administrasi AI tidak akan menyusun naskah lengkap sebelum Anda ACC di bawah ini.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowProposeTopicModal(true)}
                                className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold flex items-center gap-1.5"
                            >
                                <Sparkles size={13} /> Tambah List Usulan AI
                            </button>
                        </div>

                        {proposedItems.length === 0 ? (
                            <div className="p-10 text-center space-y-2 text-slate-400">
                                <ClipboardCheck className="mx-auto opacity-40" size={30} />
                                <p className="text-xs font-semibold">Belum ada usulan menunggu ACC saat ini.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {proposedItems.map(item => {
                                    const isEditingThis = editingProposalId === item.id;
                                    return (
                                        <div key={item.id} className="p-4 md:p-5 space-y-3 hover:bg-slate-50/40">
                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                <div className="space-y-1 flex-1 min-w-[240px]">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                                            {item.code}
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${CATEGORY_BADGE[item.category] || CATEGORY_BADGE.LAINNYA}`}>
                                                            {item.category}
                                                        </span>
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                                                            {item.domain || 'Umum'}
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${PRIORITY_BADGE[item.priority] || PRIORITY_BADGE.NORMAL}`}>
                                                            {item.priority}
                                                        </span>
                                                    </div>

                                                    {isEditingThis ? (
                                                        <div className="space-y-2 pt-2">
                                                            <input
                                                                type="text"
                                                                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-800"
                                                                value={proposalEdits.title}
                                                                onChange={e => setProposalEdits(prev => ({ ...prev, title: e.target.value }))}
                                                            />
                                                            <textarea
                                                                rows={2}
                                                                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700"
                                                                placeholder="Arahan / brief tambahan untuk AI saat menyusun..."
                                                                value={proposalEdits.brief}
                                                                onChange={e => setProposalEdits(prev => ({ ...prev, brief: e.target.value }))}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <h4 className="font-bold text-slate-800 text-sm pt-1">{item.title}</h4>
                                                            <p className="text-xs text-slate-600">{item.rationale}</p>
                                                            {item.brief && (
                                                                <p className="text-[11px] text-blue-700 bg-blue-50/70 border border-blue-100 rounded-lg px-2.5 py-1.5 mt-1">
                                                                    <strong>Arahan penyusunan:</strong> {item.brief}
                                                                </p>
                                                            )}
                                                        </>
                                                    )}
                                                </div>

                                                <div className="flex flex-wrap items-center gap-2 shrink-0">
                                                    {isEditingThis ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => setEditingProposalId(null)}
                                                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 text-xs font-semibold"
                                                        >
                                                            Batal Ubah
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setEditingProposalId(item.id);
                                                                setProposalEdits({
                                                                    title: item.title || '',
                                                                    brief: item.brief || '',
                                                                    priority: item.priority || 'NORMAL'
                                                                });
                                                            }}
                                                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1"
                                                        >
                                                            <Edit3 size={12} /> Ubah Arahan
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        disabled={Boolean(busyAction)}
                                                        onClick={() => handleAccItem(item, true)}
                                                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 disabled:opacity-50"
                                                    >
                                                        {busyAction === `acc-${item.id}` ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                                                        ACC &amp; Susun Draft
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={Boolean(busyAction)}
                                                        onClick={() => handleAccItem(item, false)}
                                                        className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold disabled:opacity-50"
                                                    >
                                                        ACC (Antrekan)
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={Boolean(busyAction)}
                                                        onClick={() => handleRejectItem(item)}
                                                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
                                                        title="Tolak Usulan"
                                                    >
                                                        <XCircle size={17} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Approved Queue awaiting drafting */}
                    {approvedQueueItems.length > 0 && (
                        <div className="bg-white rounded-2xl border border-blue-100 shadow-xs overflow-hidden">
                            <div className="p-4 border-b border-blue-100 bg-blue-50/50">
                                <h3 className="font-bold text-blue-900 text-sm">
                                    Sudah Di-ACC — Menunggu Penyusunan Draft ({approvedQueueItems.length})
                                </h3>
                                <p className="text-[11px] text-blue-700">
                                    Akan disusun otomatis oleh Staf Administrasi AI pada shift harian atau klik Susun Draft Sekarang.
                                </p>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {approvedQueueItems.map(item => (
                                    <div key={item.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-[10px] text-slate-500">{item.code}</span>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${CATEGORY_BADGE[item.category] || CATEGORY_BADGE.LAINNYA}`}>
                                                    {item.category}
                                                </span>
                                                <span className="text-[10px] text-emerald-700 font-bold">
                                                    ACC oleh {item.approvedByName || 'Pimpinan'}
                                                </span>
                                            </div>
                                            <div className="font-bold text-sm text-slate-800 mt-1">{item.title}</div>
                                        </div>
                                        <button
                                            type="button"
                                            disabled={Boolean(busyAction)}
                                            onClick={() => handleDraftQueueItem(item)}
                                            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                                        >
                                            {busyAction === `draft-${item.id}` ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                            Susun Draft Sekarang
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : activeTab === 'REPORTS' ? (
                <div className="space-y-4">
                    {supervisorReports.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center space-y-3 text-slate-400">
                            <Bot className="mx-auto opacity-40" size={32} />
                            <p className="text-sm font-semibold text-slate-600">Belum ada laporan harian Staf Supervisi AI.</p>
                            <button
                                type="button"
                                onClick={handleRunSupervisor}
                                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
                            >
                                Buat Laporan Hari Ini
                            </button>
                        </div>
                    ) : (
                        supervisorReports.map(rep => {
                            let snap = null;
                            try {
                                snap = rep.metricsSnapshot ? JSON.parse(rep.metricsSnapshot) : null;
                            } catch {
                                snap = null;
                            }
                            return (
                                <div key={rep.id} className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
                                    <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-mono text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">
                                                    {rep.code}
                                                </span>
                                                <span className="text-xs text-slate-500">
                                                    Tanggal Output: <strong>{rep.outputDate}</strong> • Pemicu: {rep.triggeredBy}
                                                </span>
                                            </div>
                                            <h3 className="font-bold text-slate-800 text-base mt-1">{rep.title}</h3>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => openDocumentModal(rep, false)}
                                                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1"
                                            >
                                                <Eye size={13} /> Baca / Revisi
                                            </button>
                                            <button
                                                type="button"
                                                disabled={busyAction === `pdf-${rep.id}`}
                                                onClick={() => handleDownloadPdf(rep)}
                                                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1"
                                            >
                                                <Download size={13} /> Unduh PDF KOP
                                            </button>
                                        </div>
                                    </div>

                                    {snap && (
                                        <div className="px-5 py-3 bg-indigo-50/40 border-b border-slate-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-[11px]">
                                            <div>Aset: <strong>{snap.assets?.total ?? 0}</strong></div>
                                            <div>Pinjam Overdue: <strong className="text-rose-600">{snap.assets?.loansOverdue ?? 0}</strong></div>
                                            <div>Maint. Terbuka: <strong>{snap.maintenance?.openCount ?? 0}</strong></div>
                                            <div>Kendaraan Aktif: <strong>{snap.vehicles?.active ?? 0}</strong></div>
                                            <div>Workshop Aktif: <strong>{snap.workshop?.activeOrders ?? 0}</strong></div>
                                            <div>Stok Menipis: <strong className="text-amber-700">{snap.warehouse?.lowStockCount ?? 0}</strong></div>
                                        </div>
                                    )}

                                    <div className="p-5 max-h-96 overflow-y-auto">
                                        <MarkdownDocumentPreview content={rep.content} />
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            ) : activeTab === 'DRAFTS' ? (
                <div className="space-y-4">
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-wrap items-center gap-3">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
                            <input
                                type="text"
                                placeholder="Cari kode, judul SOP/aturan, atau bidang..."
                                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <select
                            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700"
                            value={draftCategoryFilter}
                            onChange={e => setDraftCategoryFilter(e.target.value)}
                        >
                            <option value="ALL">Semua Kategori</option>
                            <option value="SOP">SOP</option>
                            <option value="ATURAN">Aturan</option>
                            <option value="SURAT">Surat</option>
                            <option value="LAINNYA">Lainnya</option>
                        </select>
                        <select
                            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700"
                            value={draftStatusFilter}
                            onChange={e => setDraftStatusFilter(e.target.value)}
                        >
                            <option value="ALL">Draft Siap &amp; Final</option>
                            <option value="DRAFT_READY">Draft Siap</option>
                            <option value="FINALIZED">Final (Internal)</option>
                        </select>
                    </div>

                    {adminDrafts.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400 space-y-2">
                            <FileText className="mx-auto opacity-40" size={32} />
                            <p className="text-xs font-semibold">Belum ada draft SOP/Aturan/Surat tersusun.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {adminDrafts.map(item => (
                                <div key={item.id} className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 flex flex-col justify-between gap-4">
                                    <div className="space-y-2">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <span className="font-mono text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                                                    {item.code}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${CATEGORY_BADGE[item.category] || CATEGORY_BADGE.LAINNYA}`}>
                                                    {item.category}
                                                </span>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                item.status === 'FINALIZED'
                                                    ? 'bg-emerald-100 text-emerald-700'
                                                    : 'bg-blue-50 text-blue-700'
                                            }`}>
                                                {STATUS_LABEL[item.status] || item.status}
                                            </span>
                                        </div>

                                        <h4 className="font-bold text-slate-800 text-sm leading-snug">{item.title}</h4>
                                        <p className="text-[11px] text-slate-500">
                                            Bidang: <strong>{item.domain || 'Umum'}</strong> • Tanggal: {item.outputDate}
                                        </p>
                                        <p className="text-xs text-slate-600 line-clamp-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                            {String(item.content || '').replace(/[#*`]/g, '').slice(0, 220)}...
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => openDocumentModal(item, false)}
                                                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1"
                                            >
                                                <Eye size={13} /> Baca &amp; Edit
                                            </button>
                                            <button
                                                type="button"
                                                disabled={busyAction === `pdf-${item.id}`}
                                                onClick={() => handleDownloadPdf(item)}
                                                className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold flex items-center gap-1"
                                            >
                                                <Download size={13} /> PDF KOP
                                            </button>
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                            {item.status !== 'FINALIZED' && (
                                                <button
                                                    type="button"
                                                    disabled={Boolean(busyAction)}
                                                    onClick={() => handleFinalizeDoc(item)}
                                                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                                                >
                                                    Finalkan
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                disabled={Boolean(busyAction)}
                                                onClick={() => handleDeleteDoc(item)}
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                                title="Hapus"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : activeTab === 'SETTINGS' ? (
                <form onSubmit={handleSaveConfig} className="bg-white rounded-2xl border border-slate-100 shadow-xs p-6 space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                        <div>
                            <h3 className="font-bold text-slate-800 text-base">Format SOP Umum &amp; Pengaturan Staf AI</h3>
                            <p className="text-xs text-slate-500">
                                Masukkan kerangka/format umum SOP Anda; Staf Administrasi AI akan mengikuti dan mengembangkannya secara mandiri saat menyusun draft setelah di-ACC.
                            </p>
                        </div>
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={configForm.isEnabled}
                                onChange={e => setConfigForm(prev => ({ ...prev, isEnabled: e.target.checked }))}
                            />
                            Otomasi Harian Aktif
                        </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Nama Staf Supervisi</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                                value={configForm.supervisorName}
                                onChange={e => setConfigForm(prev => ({ ...prev, supervisorName: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Nama Staf Administrasi</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                                value={configForm.adminStaffName}
                                onChange={e => setConfigForm(prev => ({ ...prev, adminStaffName: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Shift Pagi (Jam:Menit)</label>
                            <div className="flex items-center gap-1.5">
                                <input
                                    type="number"
                                    min={0}
                                    max={23}
                                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                                    value={configForm.dailyScheduleHour}
                                    onChange={e => setConfigForm(prev => ({ ...prev, dailyScheduleHour: e.target.value }))}
                                />
                                <span>:</span>
                                <input
                                    type="number"
                                    min={0}
                                    max={59}
                                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                                    value={configForm.dailyScheduleMinute}
                                    onChange={e => setConfigForm(prev => ({ ...prev, dailyScheduleMinute: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Shift Sore (Jam)</label>
                            <input
                                type="number"
                                min={0}
                                max={23}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                                value={configForm.eveningScheduleHour}
                                onChange={e => setConfigForm(prev => ({ ...prev, eveningScheduleHour: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Maks. Draft/Hari</label>
                            <input
                                type="number"
                                min={1}
                                max={5}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                                value={configForm.maxDailyDrafts}
                                onChange={e => setConfigForm(prev => ({ ...prev, maxDailyDrafts: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                            Format SOP Umum (Acuan Staf Administrasi AI)
                        </label>
                        <textarea
                            rows={14}
                            className="w-full p-3.5 rounded-xl border border-slate-200 font-mono text-xs text-slate-800 bg-slate-50/70 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500"
                            value={configForm.sopGeneralFormat}
                            onChange={e => setConfigForm(prev => ({ ...prev, sopGeneralFormat: e.target.value }))}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                            Panduan Gaya Bahasa &amp; Kebijakan Tambahan
                        </label>
                        <textarea
                            rows={4}
                            className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-700 bg-slate-50/70 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500"
                            value={configForm.policyGuidelines}
                            onChange={e => setConfigForm(prev => ({ ...prev, policyGuidelines: e.target.value }))}
                        />
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={busyAction === 'save-config'}
                            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 disabled:opacity-50"
                        >
                            {busyAction === 'save-config' ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
                            Simpan Format &amp; Pengaturan
                        </button>
                    </div>
                </form>
            ) : (
                /* LOGS TAB */
                <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/70">
                        <h3 className="font-bold text-slate-800 text-sm">Log Kerja Staf Kantor AI ({logs.length})</h3>
                    </div>
                    {logs.length === 0 ? (
                        <div className="p-10 text-center text-xs text-slate-400">Belum ada log aktivitas staf AI.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                                        <th className="p-3.5">Waktu</th>
                                        <th className="p-3.5">Staf AI</th>
                                        <th className="p-3.5">Pemicu</th>
                                        <th className="p-3.5">Status</th>
                                        <th className="p-3.5">Output</th>
                                        <th className="p-3.5">Ringkasan</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {logs.map(log => (
                                        <tr key={log.id} className="hover:bg-slate-50/60">
                                            <td className="p-3.5 whitespace-nowrap text-slate-500">
                                                {new Date(log.createdAt).toLocaleString('id-ID')}
                                            </td>
                                            <td className="p-3.5 font-bold text-slate-700">{log.staffRole}</td>
                                            <td className="p-3.5 text-slate-600">{log.trigger}</td>
                                            <td className="p-3.5">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                    log.status === 'SUCCESS'
                                                        ? 'bg-emerald-100 text-emerald-700'
                                                        : log.status === 'PARTIAL'
                                                            ? 'bg-amber-100 text-amber-800'
                                                            : 'bg-rose-100 text-rose-700'
                                                }`}>
                                                    {log.status}
                                                </span>
                                            </td>
                                            <td className="p-3.5 whitespace-nowrap text-slate-600">
                                                +{log.itemsCreated} baru / {log.itemsDrafted} draft
                                            </td>
                                            <td className="p-3.5 text-slate-700">
                                                <div>{log.summary}</div>
                                                {log.errorMessage && (
                                                    <div className="text-[10px] text-amber-700 mt-0.5">Catatan: {log.errorMessage}</div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Modal: Propose AI Backlog List */}
            {showProposeTopicModal && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <form onSubmit={handleProposeBacklog} className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-slate-800 text-base">Minta Staf AI Buat List Usulan</h3>
                            <button type="button" onClick={() => setShowProposeTopicModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={18} />
                            </button>
                        </div>
                        <p className="text-xs text-slate-500">
                            Staf Administrasi AI akan menyusun daftar usulan terlebih dahulu. Draft lengkap baru dikerjakan setelah Anda ACC.
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Kategori</label>
                                <select
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                                    value={proposeForm.category}
                                    onChange={e => setProposeForm(prev => ({ ...prev, category: e.target.value }))}
                                >
                                    <option value="ALL">Campuran (SOP/Aturan/Surat)</option>
                                    <option value="SOP">Khusus SOP</option>
                                    <option value="ATURAN">Khusus Aturan</option>
                                    <option value="SURAT">Khusus Surat</option>
                                    <option value="LAINNYA">Lainnya</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Jumlah Usulan</label>
                                <input
                                    type="number"
                                    min={1}
                                    max={8}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                                    value={proposeForm.count}
                                    onChange={e => setProposeForm(prev => ({ ...prev, count: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Fokus Topik (Opsional)</label>
                            <textarea
                                rows={3}
                                placeholder="Contoh: Pengelolaan rumah dinas & ketertiban pengembalian kunci kendaraan..."
                                className="w-full p-3 rounded-xl border border-slate-200 text-xs"
                                value={proposeForm.focusTopic}
                                onChange={e => setProposeForm(prev => ({ ...prev, focusTopic: e.target.value }))}
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button type="button" onClick={() => setShowProposeTopicModal(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600">
                                Batal
                            </button>
                            <button
                                type="submit"
                                disabled={busyAction === 'propose'}
                                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                            >
                                {busyAction === 'propose' ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                Hasilkan List Usulan
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Modal: Manual Specific Document Request */}
            {showManualModal && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <form onSubmit={handleCreateManualItem} className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-slate-800 text-base">Perintahkan Staf Administrasi AI</h3>
                            <button type="button" onClick={() => setShowManualModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={18} />
                            </button>
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Judul Dokumen / SOP / Aturan *</label>
                            <input
                                required
                                type="text"
                                placeholder="Misal: SOP Serah Terima Kunci & BBM Kendaraan Dinas"
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                                value={manualForm.title}
                                onChange={e => setManualForm(prev => ({ ...prev, title: e.target.value }))}
                            />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Kategori</label>
                                <select
                                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                                    value={manualForm.category}
                                    onChange={e => setManualForm(prev => ({ ...prev, category: e.target.value }))}
                                >
                                    <option value="SOP">SOP</option>
                                    <option value="ATURAN">Aturan</option>
                                    <option value="SURAT">Surat</option>
                                    <option value="LAINNYA">Lainnya</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Bidang</label>
                                <select
                                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                                    value={manualForm.domain}
                                    onChange={e => setManualForm(prev => ({ ...prev, domain: e.target.value }))}
                                >
                                    {DOMAIN_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Prioritas</label>
                                <select
                                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                                    value={manualForm.priority}
                                    onChange={e => setManualForm(prev => ({ ...prev, priority: e.target.value }))}
                                >
                                    <option value="URGENT">URGENT</option>
                                    <option value="HIGH">HIGH</option>
                                    <option value="NORMAL">NORMAL</option>
                                    <option value="LOW">LOW</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Arahan / Poin Isi yang Diminta</label>
                            <textarea
                                rows={3}
                                placeholder="Tuliskan poin penting yang wajib dicantumkan Staf AI..."
                                className="w-full p-3 rounded-xl border border-slate-200 text-xs"
                                value={manualForm.brief}
                                onChange={e => setManualForm(prev => ({ ...prev, brief: e.target.value }))}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5 text-xs text-slate-700 bg-slate-50 p-3 rounded-xl">
                            <label className="flex items-center gap-2 font-semibold cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={manualForm.autoApprove}
                                    onChange={e => setManualForm(prev => ({ ...prev, autoApprove: e.target.checked }))}
                                />
                                Langsung ACC usulan ini
                            </label>
                            {manualForm.autoApprove && (
                                <label className="flex items-center gap-2 font-semibold cursor-pointer pl-5">
                                    <input
                                        type="checkbox"
                                        checked={manualForm.draftNow}
                                        onChange={e => setManualForm(prev => ({ ...prev, draftNow: e.target.checked }))}
                                    />
                                    Langsung susun draft lengkap sekarang juga
                                </label>
                            )}
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button type="button" onClick={() => setShowManualModal(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600">
                                Batal
                            </button>
                            <button
                                type="submit"
                                disabled={busyAction === 'manual'}
                                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                            >
                                {busyAction === 'manual' ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                                Simpan &amp; Proses
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Modal: Document Reader / Editor / AI Revision */}
            {selectedDoc && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setSelectedDoc(null)}>
                    <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-[10px] font-bold bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded">
                                        {selectedDoc.code}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${CATEGORY_BADGE[selectedDoc.category] || CATEGORY_BADGE.LAINNYA}`}>
                                        {selectedDoc.category}
                                    </span>
                                    <span className="text-[11px] font-bold text-blue-700">
                                        {STATUS_LABEL[selectedDoc.status] || selectedDoc.status}
                                    </span>
                                </div>
                                <h3 className="font-bold text-slate-800 text-base mt-1">{selectedDoc.title}</h3>
                            </div>
                            <button type="button" onClick={() => setSelectedDoc(null)} className="p-2 rounded-full hover:bg-slate-200 text-slate-500">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-5 overflow-y-auto flex-1 space-y-4">
                            {isEditingDoc ? (
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Judul Dokumen</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold"
                                            value={docEditForm.title}
                                            onChange={e => setDocEditForm(prev => ({ ...prev, title: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Isi Naskah (Markdown)</label>
                                        <textarea
                                            rows={16}
                                            className="w-full p-3 rounded-xl border border-slate-200 font-mono text-xs text-slate-800"
                                            value={docEditForm.content}
                                            onChange={e => setDocEditForm(prev => ({ ...prev, content: e.target.value }))}
                                        />
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <button type="button" onClick={() => setIsEditingDoc(false)} className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600">
                                            Batal
                                        </button>
                                        <button
                                            type="button"
                                            disabled={busyAction === 'save-doc'}
                                            onClick={handleSaveDocEdits}
                                            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center gap-1.5"
                                        >
                                            <Save size={14} /> Simpan Naskah
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-slate-50/60 border border-slate-200/80 rounded-2xl p-5">
                                    <MarkdownDocumentPreview content={selectedDoc.content} />
                                </div>
                            )}

                            {/* Revise with AI */}
                            <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3.5 space-y-2">
                                <label className="block text-[11px] font-bold text-indigo-900 uppercase">
                                    Minta Staf AI Merevisi Naskah Ini
                                </label>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <input
                                        type="text"
                                        placeholder="Contoh: Tambahkan pasal sanksi keterlambatan dan kolom tanda tangan PJ unit..."
                                        className="flex-1 px-3 py-2 rounded-xl border border-indigo-200 bg-white text-xs"
                                        value={revisionPrompt}
                                        onChange={e => setRevisionPrompt(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        disabled={!revisionPrompt.trim() || busyAction === 'revise-ai'}
                                        onClick={handleReviseWithAi}
                                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
                                    >
                                        {busyAction === 'revise-ai' ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                        Revisi dengan AI
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!isEditingDoc) {
                                            setDocEditForm({ title: selectedDoc.title || '', content: selectedDoc.content || '' });
                                        }
                                        setIsEditingDoc(!isEditingDoc);
                                    }}
                                    className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5"
                                >
                                    <Edit3 size={14} /> {isEditingDoc ? 'Lihat Pratinjau' : 'Edit Manual'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        navigator.clipboard?.writeText(selectedDoc.content || '');
                                        showNotice('Teks dokumen disalin ke clipboard.');
                                    }}
                                    className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5"
                                >
                                    <Copy size={14} /> Salin Teks
                                </button>
                                <button
                                    type="button"
                                    disabled={busyAction === `pdf-${selectedDoc.id}`}
                                    onClick={() => handleDownloadPdf(selectedDoc)}
                                    className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5"
                                >
                                    <Download size={14} /> Unduh PDF KOP
                                </button>
                            </div>

                            {selectedDoc.status !== 'FINALIZED' && (
                                <button
                                    type="button"
                                    disabled={Boolean(busyAction)}
                                    onClick={() => handleFinalizeDoc(selectedDoc)}
                                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5"
                                >
                                    <CheckCircle2 size={14} /> Tandai Final (Internal Kantor AI)
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
