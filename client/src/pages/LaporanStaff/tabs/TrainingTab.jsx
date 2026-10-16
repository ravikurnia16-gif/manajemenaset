import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    GraduationCap, Plus, Search, Calendar, FileText, Download, Eye, 
    Trash2, Edit3, X, CheckCircle2, AlertCircle, Loader2, Award, 
    Building2, MapPin, User, FileCheck, RefreshCw, Filter, Sparkles,
    Clock, ExternalLink, ShieldCheck, Globe, Users, BookOpen, Layers
} from 'lucide-react';
import dayjs from 'dayjs';
import api from '../../../lib/axios';

export default function TrainingTab({ isKabid, user, staffList = [] }) {
    // Data states
    const [trainings, setTrainings] = useState([]);
    const [stats, setStats] = useState({
        totalTrainings: 0,
        uniqueParticipants: 0,
        thisMonthCount: 0,
        thisYearCount: 0,
        onlineCount: 0,
        offlineCount: 0,
        hybridCount: 0,
        withModuleCount: 0
    });
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [deletingId, setDeletingId] = useState(null);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStaffFilter, setSelectedStaffFilter] = useState('ALL');
    const [methodFilter, setMethodFilter] = useState('ALL');
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');

    // Check if user is manager / admin aset / kabid
    const canManageAll = useMemo(() => {
        if (isKabid) return true;
        const role = user?.role || '';
        const pos = (user?.position || '').toLowerCase();
        return ['ADMIN_ASET', 'SUPER_ADMIN'].includes(role) || 
               pos.includes('admin aset') || 
               pos.includes('manajemen aset') ||
               pos.includes('sarana');
    }, [isKabid, user]);

    // Ensure currently logged-in user is always in the staff list so their name can be selected/shown
    const staffOptions = useMemo(() => {
        const list = Array.isArray(staffList) ? [...staffList] : [];
        if (user?.id) {
            const exists = list.some(s => String(s.id) === String(user.id));
            if (!exists) {
                list.unshift({
                    id: user.id,
                    name: user.name || user.username || 'Saya (Admin Aset)',
                    position: user.position || 'Admin Aset'
                });
            }
        }
        if (editingItem?.user?.id) {
            const exists = list.some(s => String(s.id) === String(editingItem.user.id));
            if (!exists) {
                list.push({
                    id: editingItem.user.id,
                    name: editingItem.user.name,
                    position: editingItem.user.position || 'Staf'
                });
            }
        }
        return list;
    }, [staffList, user, editingItem]);

    // Modal Form States
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({
        userId: user?.id ? String(user.id) : '',
        title: '',
        scheduleDate: dayjs().format('YYYY-MM-DD'),
        endDate: '',
        organizer: '',
        location: '',
        method: 'OFFLINE', // OFFLINE | ONLINE | HYBRID
        description: '',
        certificateNo: '',
        status: 'COMPLETED'
    });

    // File 1: Bukti Sertifikat / Kehadiran (Wajib)
    const [selectedFile, setSelectedFile] = useState(null);
    const [fileError, setFileError] = useState('');
    const fileInputRef = useRef(null);

    // File 2: Modul / Materi Pelatihan (Opsional)
    const [selectedModuleFile, setSelectedModuleFile] = useState(null);
    const [moduleFileError, setModuleFileError] = useState('');
    const [removeExistingModule, setRemoveExistingModule] = useState(false);
    const moduleFileInputRef = useRef(null);

    // PDF Preview Modal
    const [previewPdfUrl, setPreviewPdfUrl] = useState(null);
    const [previewTitle, setPreviewTitle] = useState('');

    // Feedback Toast
    const [feedback, setFeedback] = useState(null);

    const showToast = (message, type = 'success') => {
        setFeedback({ message, type });
        setTimeout(() => setFeedback(null), 4000);
    };

    // Fetch Trainings List
    const fetchTrainings = async () => {
        try {
            setLoading(true);
            const params = {};
            if (canManageAll && selectedStaffFilter !== 'ALL') {
                params.userId = selectedStaffFilter;
            }
            if (methodFilter !== 'ALL') {
                params.method = methodFilter;
            }
            if (searchQuery.trim()) {
                params.search = searchQuery.trim();
            }
            if (filterStartDate) params.startDate = filterStartDate;
            if (filterEndDate) params.endDate = filterEndDate;

            const res = await api.get('/personnel/trainings', { params });
            if (res.data?.success) {
                setTrainings(res.data.data || []);
            }
        } catch (err) {
            console.error('Failed to fetch trainings:', err);
            showToast(err.response?.data?.error || 'Gagal memuat data pelatihan', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Fetch Stats
    const fetchStats = async () => {
        try {
            const res = await api.get('/personnel/trainings/stats');
            if (res.data?.success) {
                setStats(res.data.stats || {});
            }
        } catch (err) {
            console.error('Failed to fetch training stats:', err);
        }
    };

    useEffect(() => {
        fetchTrainings();
        fetchStats();
    }, [selectedStaffFilter, methodFilter, filterStartDate, filterEndDate]);

    // Handle Open Create Modal
    const handleOpenCreateModal = () => {
        setEditingItem(null);
        setFormData({
            userId: user?.id ? String(user.id) : (staffOptions[0]?.id ? String(staffOptions[0].id) : ''),
            title: '',
            scheduleDate: dayjs().format('YYYY-MM-DD'),
            endDate: '',
            organizer: '',
            location: '',
            method: 'OFFLINE',
            description: '',
            certificateNo: '',
            status: 'COMPLETED'
        });
        setSelectedFile(null);
        setSelectedModuleFile(null);
        setFileError('');
        setModuleFileError('');
        setRemoveExistingModule(false);
        setShowModal(true);
    };

    // Handle Open Edit Modal
    const handleOpenEditModal = (item) => {
        setEditingItem(item);
        setFormData({
            userId: item.userId ? String(item.userId) : (user?.id ? String(user.id) : ''),
            title: item.title || '',
            scheduleDate: item.scheduleDate ? dayjs(item.scheduleDate).format('YYYY-MM-DD') : '',
            endDate: item.endDate ? dayjs(item.endDate).format('YYYY-MM-DD') : '',
            organizer: item.organizer || '',
            location: item.location || '',
            method: item.method || 'OFFLINE',
            description: item.description || '',
            certificateNo: item.certificateNo || '',
            status: item.status || 'COMPLETED'
        });
        setSelectedFile(null);
        setSelectedModuleFile(null);
        setFileError('');
        setModuleFileError('');
        setRemoveExistingModule(false);
        setShowModal(true);
    };

    // Handle Bukti File Selection (PDF)
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        setFileError('');
        if (!file) {
            setSelectedFile(null);
            return;
        }

        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            setFileError('File bukti wajib berformat PDF (.pdf)');
            setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        if (file.size > 30 * 1024 * 1024) {
            setFileError('Ukuran file maksimal 30MB');
            setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        setSelectedFile(file);
    };

    // Handle Module File Selection (Optional)
    const handleModuleFileChange = (e) => {
        const file = e.target.files[0];
        setModuleFileError('');
        if (!file) {
            setSelectedModuleFile(null);
            return;
        }

        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            setModuleFileError('Modul disarankan berformat PDF (.pdf)');
            setSelectedModuleFile(null);
            if (moduleFileInputRef.current) moduleFileInputRef.current.value = '';
            return;
        }

        if (file.size > 50 * 1024 * 1024) {
            setModuleFileError('Ukuran file modul maksimal 50MB');
            setSelectedModuleFile(null);
            if (moduleFileInputRef.current) moduleFileInputRef.current.value = '';
            return;
        }

        setSelectedModuleFile(file);
        setRemoveExistingModule(false);
    };

    // Submit Create or Update
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (submitting) return;

        if (!formData.title.trim()) {
            showToast('Judul pelatihan wajib diisi!', 'error');
            return;
        }
        if (!formData.scheduleDate) {
            showToast('Jadwal pelatihan wajib diisi!', 'error');
            return;
        }
        if (!editingItem && !selectedFile) {
            showToast('Bukti dokumen PDF pelatihan wajib diunggah!', 'error');
            return;
        }

        try {
            setSubmitting(true);
            const form = new FormData();
            form.append('title', formData.title.trim());
            form.append('scheduleDate', formData.scheduleDate);
            if (formData.endDate) form.append('endDate', formData.endDate);
            if (formData.organizer) form.append('organizer', formData.organizer.trim());
            if (formData.location) form.append('location', formData.location.trim());
            form.append('method', formData.method || 'OFFLINE');
            if (formData.description) form.append('description', formData.description.trim());
            if (formData.certificateNo) form.append('certificateNo', formData.certificateNo.trim());
            const targetUserId = formData.userId || user?.id;
            if (targetUserId) form.append('userId', targetUserId);

            // Bukti Dokumen PDF
            if (selectedFile) {
                form.append('file', selectedFile);
            }

            // Modul Pelatihan (Opsional)
            if (selectedModuleFile) {
                form.append('moduleFile', selectedModuleFile);
            } else if (removeExistingModule) {
                form.append('removeModule', 'true');
            }

            if (editingItem) {
                await api.put(`/personnel/trainings/${editingItem.id}`, form, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                showToast('Data pelatihan berhasil diperbarui!');
            } else {
                await api.post('/personnel/trainings', form, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                showToast('Pelatihan berhasil ditambahkan dan disimpan ke MinIO!');
            }

            setShowModal(false);
            fetchTrainings();
            fetchStats();
        } catch (err) {
            console.error('Error saving training:', err);
            showToast(err.response?.data?.error || 'Gagal menyimpan data pelatihan', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // Handle Delete
    const handleDelete = async (id, title) => {
        if (!window.confirm(`Yakin ingin menghapus riwayat pelatihan "${title}"? Dokumen bukti dan modul di MinIO juga akan dihapus.`)) {
            return;
        }

        try {
            setDeletingId(id);
            await api.delete(`/personnel/trainings/${id}`);
            showToast('Pelatihan berhasil dihapus');
            fetchTrainings();
            fetchStats();
        } catch (err) {
            console.error('Error deleting training:', err);
            showToast(err.response?.data?.error || 'Gagal menghapus pelatihan', 'error');
        } finally {
            setDeletingId(null);
        }
    };

    // Format bytes helper
    const formatBytes = (bytes) => {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    // Method badge helper
    const renderMethodBadge = (method) => {
        if (method === 'ONLINE') {
            return (
                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
                    <Globe size={11} /> Online (Daring)
                </span>
            );
        }
        if (method === 'HYBRID') {
            return (
                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                    <Layers size={11} /> Hybrid
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                <Building2 size={11} /> Offline (Tatap Muka)
            </span>
        );
    };

    return (
        <div className="space-y-6">
            {/* Feedback Alert Toast */}
            {feedback && (
                <div className={`p-4 rounded-2xl flex items-center justify-between text-xs font-bold shadow-md transition-all animate-in fade-in slide-in-from-top-2 ${
                    feedback.type === 'error' 
                        ? 'bg-rose-50 border border-rose-200 text-rose-800' 
                        : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                }`}>
                    <div className="flex items-center gap-2">
                        {feedback.type === 'error' ? <AlertCircle size={18} className="text-rose-600" /> : <CheckCircle2 size={18} className="text-emerald-600" />}
                        <span>{feedback.message}</span>
                    </div>
                    <button onClick={() => setFeedback(null)} className="p-1 hover:bg-black/5 rounded-lg">
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Header & Stats Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-amber-600 to-orange-700 p-5 rounded-3xl text-white shadow-lg shadow-amber-500/20 relative overflow-hidden">
                    <div className="absolute -right-3 -bottom-3 opacity-15">
                        <GraduationCap size={96} />
                    </div>
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 bg-white/15 backdrop-blur-md rounded-2xl">
                            <Award size={20} className="text-white" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
                            Semua Waktu
                        </span>
                    </div>
                    <p className="text-xs font-medium text-amber-100">Total Pelatihan</p>
                    <h3 className="text-2xl font-black mt-0.5">{stats.totalTrainings || 0}</h3>
                    <p className="text-[10px] text-amber-100/80 mt-1 font-medium">
                        {stats.onlineCount || 0} Online • {stats.offlineCount || 0} Offline
                    </p>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 bg-indigo-50 rounded-2xl text-indigo-600">
                            <User size={20} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                            Partisipan
                        </span>
                    </div>
                    <p className="text-xs font-medium text-slate-500">Karyawan Terlatih</p>
                    <h3 className="text-2xl font-black text-slate-800 mt-0.5">{stats.uniqueParticipants || 0}</h3>
                    <p className="text-[10px] text-slate-400 mt-1">Personil yang telah mengikuti pelatihan</p>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 bg-emerald-50 rounded-2xl text-emerald-600">
                            <Calendar size={20} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                            Bulan Ini
                        </span>
                    </div>
                    <p className="text-xs font-medium text-slate-500">Pelatihan Bulan Ini</p>
                    <h3 className="text-2xl font-black text-slate-800 mt-0.5">{stats.thisMonthCount || 0}</h3>
                    <p className="text-[10px] text-slate-400 mt-1">{dayjs().format('MMMM YYYY')}</p>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 bg-violet-50 rounded-2xl text-violet-600">
                            <BookOpen size={20} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full">
                            Modul Terlampir
                        </span>
                    </div>
                    <p className="text-xs font-medium text-slate-500">Modul / Materi Pelatihan</p>
                    <h3 className="text-2xl font-black text-slate-800 mt-0.5">{stats.withModuleCount || 0}</h3>
                    <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                        <Sparkles size={11} className="text-violet-500" />
                        Tersimpan di MinIO Object Storage
                    </p>
                </div>
            </div>

            {/* Action Bar & Filters */}
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                        <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                            <GraduationCap className="text-amber-600" size={20} />
                            Pelatihan Karyawan
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Dokumentasi riwayat sertifikasi, workshop, modul pembelajaran, dan peningkatan kompetensi staf.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={handleOpenCreateModal}
                            className="px-4 py-2.5 bg-amber-600 text-white rounded-2xl text-xs font-bold hover:bg-amber-700 transition-all flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer"
                        >
                            <Plus size={16} /> Tambah Pelatihan
                        </button>
                        <button
                            onClick={() => { fetchTrainings(); fetchStats(); }}
                            title="Segarkan Data"
                            className="p-2.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-2xl border border-slate-200 transition-all cursor-pointer"
                        >
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-2 border-t border-slate-100">
                    {/* Search */}
                    <div className="relative">
                        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Cari judul, lembaga, materi..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-amber-500"
                        />
                    </div>

                    {/* Method Filter (Online / Offline / Hybrid) */}
                    <div>
                        <select
                            value={methodFilter}
                            onChange={(e) => setMethodFilter(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-amber-500"
                        >
                            <option value="ALL">Semua Metode (Online/Offline)</option>
                            <option value="OFFLINE">🏢 Tatap Muka (Offline)</option>
                            <option value="ONLINE">🌐 Daring (Online)</option>
                            <option value="HYBRID">🔄 Hybrid (Campuran)</option>
                        </select>
                    </div>

                    {/* Staff Filter (For Kabid & Admin Aset) */}
                    {canManageAll ? (
                        <div>
                            <select
                                value={selectedStaffFilter}
                                onChange={(e) => setSelectedStaffFilter(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-amber-500"
                            >
                                <option value="ALL">Semua Karyawan</option>
                                {staffOptions.map(s => (
                                    <option key={s.id} value={String(s.id)}>
                                        {s.name} ({s.position || 'Staf'})
                                    </option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 flex items-center gap-1.5 truncate">
                            <User size={14} className="text-amber-600 shrink-0" />
                            <span className="truncate">{user?.name || user?.username || 'Saya'}</span>
                        </div>
                    )}

                    {/* Start Date */}
                    <div>
                        <input
                            type="date"
                            value={filterStartDate}
                            onChange={(e) => setFilterStartDate(e.target.value)}
                            placeholder="Tanggal Mulai"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-amber-500"
                        />
                    </div>

                    {/* End Date */}
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={filterEndDate}
                            onChange={(e) => setFilterEndDate(e.target.value)}
                            placeholder="Tanggal Akhir"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-amber-500"
                        />
                        {(filterStartDate || filterEndDate || searchQuery || methodFilter !== 'ALL' || selectedStaffFilter !== 'ALL') && (
                            <button
                                onClick={() => {
                                    setSearchQuery('');
                                    setMethodFilter('ALL');
                                    setSelectedStaffFilter('ALL');
                                    setFilterStartDate('');
                                    setFilterEndDate('');
                                }}
                                title="Reset Filter"
                                className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer"
                            >
                                Reset
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Content List */}
            {loading ? (
                <div className="h-64 flex flex-col items-center justify-center gap-3 bg-white rounded-3xl border border-slate-100 shadow-sm">
                    <Loader2 className="animate-spin text-amber-600" size={36} />
                    <span className="text-slate-400 text-xs font-bold">Memuat daftar pelatihan karyawan...</span>
                </div>
            ) : trainings.length === 0 ? (
                <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-12 text-center space-y-3">
                    <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                        <GraduationCap size={32} />
                    </div>
                    <h3 className="text-sm font-bold text-slate-700">Belum Ada Data Pelatihan</h3>
                    <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                        Belum ada riwayat pelatihan karyawan yang diunggah. Klik tombol <strong>Tambah Pelatihan</strong> untuk mengunggah dokumen sertifikat/bukti dan modul materi pelatihan ke MinIO.
                    </p>
                    <button
                        onClick={handleOpenCreateModal}
                        className="px-5 py-2.5 bg-amber-600 text-white rounded-2xl text-xs font-bold hover:bg-amber-700 transition-all inline-flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer"
                    >
                        <Plus size={16} /> Tambah Pelatihan Sekarang
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {trainings.map((item) => {
                        const canEdit = canManageAll || item.userId === user?.id;

                        return (
                            <div 
                                key={item.id}
                                className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
                            >
                                <div className="space-y-3">
                                    {/* Top Bar: Date & Method Badge */}
                                    <div className="flex items-start justify-between gap-2 flex-wrap">
                                        <div className="flex items-center gap-1.5 text-[11px] font-black text-amber-700 bg-amber-50 px-2.5 py-1 rounded-xl">
                                            <Calendar size={13} />
                                            <span>{dayjs(item.scheduleDate).format('DD MMMM YYYY')}</span>
                                            {item.endDate && (
                                                <span> - {dayjs(item.endDate).format('DD MMM YYYY')}</span>
                                            )}
                                        </div>
                                        {renderMethodBadge(item.method)}
                                    </div>

                                    {/* Title & Description */}
                                    <div>
                                        <h3 className="text-sm font-black text-slate-800 line-clamp-2 group-hover:text-amber-600 transition-colors">
                                            {item.title}
                                        </h3>
                                        {item.description && (
                                            <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                                                {item.description}
                                            </p>
                                        )}
                                    </div>

                                    {/* Meta Details */}
                                    <div className="space-y-1.5 pt-2 border-t border-slate-50 text-[11px]">
                                        {/* User Info */}
                                        <div className="flex items-center gap-2 text-slate-700">
                                            <User size={14} className="text-slate-400 shrink-0" />
                                            <span className="font-bold truncate">{item.user?.name || item.user?.username || 'Karyawan'}</span>
                                            {item.user?.position && (
                                                <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded truncate">
                                                    {item.user.position}
                                                </span>
                                            )}
                                        </div>

                                        {/* Penyelenggara (Prominent) */}
                                        {item.organizer && (
                                            <div className="flex items-center gap-2 text-slate-700 font-medium">
                                                <Building2 size={14} className="text-amber-600 shrink-0" />
                                                <span className="truncate">Penyelenggara: <strong>{item.organizer}</strong></span>
                                            </div>
                                        )}

                                        {/* Location */}
                                        {item.location && (
                                            <div className="flex items-center gap-2 text-slate-600">
                                                <MapPin size={14} className="text-slate-400 shrink-0" />
                                                <span className="truncate">{item.location}</span>
                                            </div>
                                        )}

                                        {/* Certificate No */}
                                        {item.certificateNo && (
                                            <div className="flex items-center gap-2 text-amber-700 font-medium">
                                                <Award size={14} className="text-amber-500 shrink-0" />
                                                <span className="truncate">No. Sertifikat: {item.certificateNo}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Modul Attachment Badge (If Available) */}
                                    {item.moduleUrl && (
                                        <div className="bg-violet-50/70 p-2 rounded-xl border border-violet-100 flex items-center justify-between gap-2 text-[11px]">
                                            <div className="flex items-center gap-1.5 text-violet-700 truncate">
                                                <BookOpen size={13} className="shrink-0" />
                                                <span className="font-bold truncate">Modul: {item.moduleFileName || 'Materi Pelatihan.pdf'}</span>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setPreviewPdfUrl(item.moduleUrl);
                                                    setPreviewTitle(`Modul: ${item.title}`);
                                                }}
                                                className="text-[10px] font-black text-violet-700 hover:underline shrink-0 cursor-pointer"
                                            >
                                                Buka Modul
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Bottom Bar: File info & Actions */}
                                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 truncate">
                                        <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg shrink-0">
                                            <FileText size={14} />
                                        </div>
                                        <div className="truncate">
                                            <p className="text-[11px] font-bold text-slate-700 truncate max-w-[130px]" title={item.fileName || 'Bukti Pelatihan.pdf'}>
                                                {item.fileName || 'Bukti.pdf'}
                                            </p>
                                            <p className="text-[9px] text-slate-400">
                                                {formatBytes(item.fileSize)} • MinIO
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                        {/* Preview Bukti PDF */}
                                        <button
                                            onClick={() => {
                                                setPreviewPdfUrl(item.fileUrl);
                                                setPreviewTitle(`Bukti: ${item.title}`);
                                            }}
                                            title="Lihat Bukti Sertifikat"
                                            className="p-2 bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white rounded-xl transition-all cursor-pointer"
                                        >
                                            <Eye size={14} />
                                        </button>

                                        {/* Download Direct */}
                                        <a
                                            href={item.fileUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            download
                                            title="Unduh / Buka Dokumen"
                                            className="p-2 bg-slate-50 text-slate-600 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
                                        >
                                            <Download size={14} />
                                        </a>

                                        {/* Edit */}
                                        {canEdit && (
                                            <button
                                                onClick={() => handleOpenEditModal(item)}
                                                title="Ubah Data"
                                                className="p-2 bg-slate-50 text-slate-600 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
                                            >
                                                <Edit3 size={14} />
                                            </button>
                                        )}

                                        {/* Delete */}
                                        {canEdit && (
                                            <button
                                                onClick={() => handleDelete(item.id, item.title)}
                                                disabled={deletingId === item.id}
                                                title="Hapus"
                                                className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl transition-all cursor-pointer disabled:opacity-50"
                                            >
                                                {deletingId === item.id ? (
                                                    <Loader2 size={14} className="animate-spin" />
                                                ) : (
                                                    <Trash2 size={14} />
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* MODAL: Form Tambah / Edit Pelatihan */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-xl space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-amber-50 text-amber-600 rounded-2xl">
                                    <GraduationCap size={20} />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-800">
                                        {editingItem ? 'Edit Data Pelatihan' : 'Tambah Pelatihan Karyawan'}
                                    </h3>
                                    <p className="text-xs text-slate-400">
                                        Isi data penyelenggara, metode online/offline, bukti PDF, dan modul
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowModal(false)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Target User / Nama Karyawan */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs font-bold text-slate-700">
                                        Nama Karyawan / Peserta *
                                    </label>
                                    <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-medium border border-amber-200/60">
                                        Otomatis terisi akun pengisi
                                    </span>
                                </div>
                                <select
                                    required
                                    value={String(formData.userId || user?.id || '')}
                                    onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-amber-500"
                                >
                                    {staffOptions.map(s => {
                                        const isCurrentUser = String(s.id) === String(user?.id);
                                        return (
                                            <option key={s.id} value={String(s.id)}>
                                                {s.name} ({s.position || 'Staf'}) {isCurrentUser ? '★ (Akun Pengisi / Saya)' : ''}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>

                            {/* 1. Judul Pelatihan */}
                            <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1">
                                    Judul Pelatihan / Kursus *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Contoh: Sertifikasi K3 Kelistrikan & Keselamatan Kerja Gedung"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-amber-500"
                                />
                            </div>

                            {/* 2. Penyelenggara & Metode (Online / Offline / Hybrid) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">
                                        Penyelenggara / Lembaga *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Contoh: Balai Latihan Kerja / BNSP / Internal"
                                        value={formData.organizer}
                                        onChange={(e) => setFormData({ ...formData, organizer: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">
                                        Metode Pelaksanaan *
                                    </label>
                                    <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, method: 'OFFLINE' })}
                                            className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                                formData.method === 'OFFLINE' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                        >
                                            Offline
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, method: 'ONLINE' })}
                                            className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                                formData.method === 'ONLINE' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                        >
                                            Online
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, method: 'HYBRID' })}
                                            className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                                formData.method === 'HYBRID' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                        >
                                            Hybrid
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* 3. Jadwal Pelatihan */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">
                                        Jadwal Pelatihan (Mulai) *
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.scheduleDate}
                                        onChange={(e) => setFormData({ ...formData, scheduleDate: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">
                                        Jadwal Selesai (Opsional)
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.endDate}
                                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                </div>
                            </div>

                            {/* Lokasi & Nomor Sertifikat */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">
                                        Lokasi Pelatihan
                                    </label>
                                    <input
                                        type="text"
                                        placeholder={formData.method === 'ONLINE' ? 'Contoh: Zoom Meeting / Google Meet' : 'Contoh: Gedung Diklat Padang'}
                                        value={formData.location}
                                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">
                                        Nomor Sertifikat (Opsional)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Contoh: CERT-2026/K3/XII/0049"
                                        value={formData.certificateNo}
                                        onChange={(e) => setFormData({ ...formData, certificateNo: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                </div>
                            </div>

                            {/* Deskripsi / Materi */}
                            <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1">
                                    Deskripsi / Rangkuman Materi
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="Rincian materi yang dipelajari atau catatan kelulusan..."
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                                />
                            </div>

                            {/* 4. Bukti Dokumen PDF (Wajib) */}
                            <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1">
                                    Bukti Dokumen Pelatihan (PDF Sertifikat / Kehadiran) *
                                </label>
                                
                                <div className="border-2 border-dashed border-slate-200 hover:border-amber-400 transition-colors p-4 rounded-2xl bg-slate-50/50 text-center space-y-2">
                                    <input
                                        type="file"
                                        accept=".pdf,application/pdf"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        className="hidden"
                                        id="training-pdf-upload"
                                    />
                                    <label
                                        htmlFor="training-pdf-upload"
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-white text-amber-700 border border-amber-200 rounded-xl text-xs font-bold cursor-pointer hover:bg-amber-50 transition-all shadow-xs"
                                    >
                                        <FileText size={15} />
                                        <span>Pilih Dokumen PDF Bukti</span>
                                    </label>

                                    {selectedFile ? (
                                        <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200 mt-2">
                                            <FileCheck size={16} className="text-emerald-600 shrink-0" />
                                            <span className="truncate max-w-[280px]">{selectedFile.name}</span>
                                            <span className="text-[10px] text-slate-400">({formatBytes(selectedFile.size)})</span>
                                        </div>
                                    ) : editingItem?.fileUrl ? (
                                        <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200 mt-2">
                                            <FileCheck size={16} className="text-amber-600 shrink-0" />
                                            <span className="truncate max-w-[280px]">{editingItem.fileName || 'Dokumen Tersimpan'}</span>
                                            <span className="text-[10px] text-slate-400">({formatBytes(editingItem.fileSize)})</span>
                                            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Tersimpan</span>
                                        </div>
                                    ) : (
                                        <p className="text-[11px] text-slate-400">
                                            Wajib PDF (Maksimal 30MB)
                                        </p>
                                    )}

                                    {fileError && (
                                        <p className="text-xs font-bold text-rose-600">{fileError}</p>
                                    )}
                                </div>
                            </div>

                            {/* 5. Modul Pelatihan (Upload Opsional) */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs font-bold text-slate-700">
                                        Modul / Handout Materi Pelatihan (Opsional)
                                    </label>
                                    <span className="text-[10px] text-slate-400 font-medium">Boleh dikosongkan</span>
                                </div>

                                <div className="border border-dashed border-slate-200 hover:border-violet-400 transition-colors p-3.5 rounded-2xl bg-slate-50/50 text-center space-y-2">
                                    <input
                                        type="file"
                                        accept=".pdf,application/pdf"
                                        ref={moduleFileInputRef}
                                        onChange={handleModuleFileChange}
                                        className="hidden"
                                        id="training-module-upload"
                                    />
                                    <label
                                        htmlFor="training-module-upload"
                                        className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white text-violet-700 border border-violet-200 rounded-xl text-xs font-bold cursor-pointer hover:bg-violet-50 transition-all shadow-xs"
                                    >
                                        <BookOpen size={14} />
                                        <span>Unggah Modul / Materi (PDF)</span>
                                    </label>

                                    {selectedModuleFile ? (
                                        <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-700 bg-white p-2 rounded-xl border border-slate-200">
                                            <FileCheck size={15} className="text-violet-600 shrink-0" />
                                            <span className="truncate max-w-[260px]">{selectedModuleFile.name}</span>
                                            <span className="text-[10px] text-slate-400">({formatBytes(selectedModuleFile.size)})</span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedModuleFile(null);
                                                    if (moduleFileInputRef.current) moduleFileInputRef.current.value = '';
                                                }}
                                                className="text-slate-400 hover:text-rose-600 ml-1"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ) : editingItem?.moduleUrl && !removeExistingModule ? (
                                        <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-700 bg-white p-2 rounded-xl border border-slate-200">
                                            <BookOpen size={15} className="text-violet-600 shrink-0" />
                                            <span className="truncate max-w-[260px]">{editingItem.moduleFileName || 'Modul Tersimpan.pdf'}</span>
                                            <span className="text-[10px] text-slate-400">({formatBytes(editingItem.moduleFileSize)})</span>
                                            <button
                                                type="button"
                                                onClick={() => setRemoveExistingModule(true)}
                                                className="text-rose-500 hover:underline text-[10px] ml-1 font-bold"
                                            >
                                                Hapus Modul
                                            </button>
                                        </div>
                                    ) : (
                                        <p className="text-[11px] text-slate-400">
                                            Format PDF (Maksimal 50MB)
                                        </p>
                                    )}

                                    {moduleFileError && (
                                        <p className="text-xs font-bold text-rose-600">{moduleFileError}</p>
                                    )}
                                </div>
                            </div>

                            {/* Info Box MinIO */}
                            <div className="bg-amber-50/70 p-2.5 rounded-xl border border-amber-100 flex items-center gap-2 text-[11px] text-amber-800 text-left">
                                <Sparkles size={14} className="text-amber-600 shrink-0" />
                                <span>Seluruh dokumen PDF dan modul dikompresi otomatis dan disimpan aman ke MinIO Object Storage.</span>
                            </div>

                            {/* Modal Footer Actions */}
                            <div className="flex gap-3 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    disabled={submitting}
                                    className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 py-2.5 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition-all flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-50"
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            <span>Mengompresi & Menyimpan...</span>
                                        </>
                                    ) : (
                                        <span>{editingItem ? 'Simpan Perubahan' : 'Simpan Pelatihan'}</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: PDF Viewer In-App */}
            {previewPdfUrl && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <div className="flex items-center gap-2 truncate">
                                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                                    <FileText size={18} />
                                </div>
                                <div className="truncate">
                                    <h4 className="text-xs font-bold text-slate-800 truncate">{previewTitle}</h4>
                                    <p className="text-[10px] text-slate-400">Pratinjau Dokumen PDF dari MinIO Storage</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <a
                                    href={previewPdfUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 text-slate-600 hover:bg-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                                >
                                    <ExternalLink size={14} /> Buka Tab Baru
                                </a>
                                <button
                                    onClick={() => setPreviewPdfUrl(null)}
                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-xl transition-all"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* PDF Frame */}
                        <div className="flex-1 bg-slate-100 p-2">
                            <iframe
                                src={`${previewPdfUrl}#toolbar=1`}
                                title="Pratinjau Dokumen Pelatihan"
                                className="w-full h-full rounded-2xl border border-slate-200 bg-white"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
