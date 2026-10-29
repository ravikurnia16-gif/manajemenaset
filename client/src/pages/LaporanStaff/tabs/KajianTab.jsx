import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    BookCheck, Plus, Search, Calendar, FileText, Download, Eye,
    Trash2, Edit3, X, CheckCircle2, AlertCircle, Loader2,
    Building2, MapPin, User, RefreshCw, Filter, Sparkles,
    Clock, ExternalLink, Image as ImageIcon, Users, BookOpen
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/id';
import api from '../../../lib/axios';

export default function KajianTab({ isKabid, user, staffList = [] }) {
    // Data states
    const [kajianList, setKajianList] = useState([]);
    const [stats, setStats] = useState({
        totalKajian: 0,
        thisMonthCount: 0,
        thisYearCount: 0,
        withPhotoCount: 0,
        uniqueLocations: 0,
        uniqueSpeakers: 0,
        uniqueParticipants: 0
    });
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [deletingId, setDeletingId] = useState(null);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStaffFilter, setSelectedStaffFilter] = useState('ALL');
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');

    // Modal Form States
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({
        userId: user?.id ? String(user.id) : '',
        date: dayjs().format('YYYY-MM-DD'),
        title: '',
        speaker: '',
        location: '',
        summary: ''
    });

    // File Upload: Foto (Opsional)
    const [selectedPhoto, setSelectedPhoto] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [photoError, setPhotoError] = useState('');
    const [removeExistingPhoto, setRemoveExistingPhoto] = useState(false);
    const fileInputRef = useRef(null);

    // Detail & Photo Viewer Modals
    const [selectedDetail, setSelectedDetail] = useState(null);
    const [previewPhotoUrl, setPreviewPhotoUrl] = useState(null);
    const [previewPhotoTitle, setPreviewPhotoTitle] = useState('');

    // Feedback Toast
    const [feedback, setFeedback] = useState(null);

    const showToast = (message, type = 'success') => {
        setFeedback({ message, type });
        setTimeout(() => setFeedback(null), 4000);
    };

    // Role check: can user view & manage all staff records
    const canManageAll = useMemo(() => {
        if (!user) return false;
        if (isKabid) return true;
        const role = user.role || '';
        const pos = (user.position || '').toLowerCase();
        return ['ADMIN_ASET', 'SUPER_ADMIN'].includes(role) ||
            pos.includes('kepala bidang') ||
            pos.includes('admin aset') ||
            pos.includes('manajemen aset') ||
            pos.includes('sarana');
    }, [isKabid, user]);

    // Local staff list state and auto-fetcher
    const [localStaffList, setLocalStaffList] = useState(Array.isArray(staffList) ? staffList : []);

    useEffect(() => {
        if (Array.isArray(staffList) && staffList.length > 0) {
            setLocalStaffList(staffList);
        } else if (canManageAll) {
            api.get('/personnel/staff')
                .then(res => {
                    const list = Array.isArray(res.data)
                        ? res.data
                        : (Array.isArray(res.data?.staff) ? res.data.staff : []);
                    setLocalStaffList(list);
                })
                .catch(err => console.error('Failed to load staff in KajianTab:', err));
        }
    }, [staffList, canManageAll]);

    // Options for Staff selector dropdown
    const staffOptions = useMemo(() => {
        const source = localStaffList.length > 0 ? localStaffList : (Array.isArray(staffList) ? staffList : []);
        const list = source.filter(s => s && typeof s === 'object' && s.id != null);
        if (user?.id) {
            const exists = list.some(s => s && s.id != null && String(s.id) === String(user.id));
            if (!exists) {
                list.unshift({
                    id: user.id,
                    name: user.name || user.username || 'Saya (Pengguna Saat Ini)',
                    position: user.position || 'Staf'
                });
            }
        }
        if (editingItem?.user?.id) {
            const exists = list.some(s => s && s.id != null && String(s.id) === String(editingItem.user.id));
            if (!exists) {
                list.push({
                    id: editingItem.user.id,
                    name: editingItem.user.name,
                    position: editingItem.user.position || 'Staf'
                });
            }
        }
        return list;
    }, [localStaffList, staffList, user, editingItem]);

    // Fetch Kajian List
    const fetchKajianList = async () => {
        try {
            setLoading(true);
            const params = {};
            if (canManageAll && selectedStaffFilter !== 'ALL') {
                params.userId = selectedStaffFilter;
            }
            if (searchQuery.trim()) {
                params.search = searchQuery.trim();
            }
            if (filterStartDate) params.startDate = filterStartDate;
            if (filterEndDate) params.endDate = filterEndDate;

            const res = await api.get('/personnel/kajian', { params });
            const list = Array.isArray(res.data?.data)
                ? res.data.data
                : (Array.isArray(res.data) ? res.data : []);
            setKajianList(list);
        } catch (err) {
            console.error('Failed to fetch kajian list:', err);
            setKajianList([]);
            showToast(err.response?.data?.error || 'Gagal memuat data kehadiran kajian', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Fetch Stats
    const fetchStats = async () => {
        try {
            const params = {};
            if (canManageAll && selectedStaffFilter !== 'ALL') {
                params.userId = selectedStaffFilter;
            }
            const res = await api.get('/personnel/kajian/stats', { params });
            if (res.data?.success && res.data?.stats) {
                setStats(res.data.stats);
            }
        } catch (err) {
            console.error('Failed to fetch kajian stats:', err);
        }
    };

    useEffect(() => {
        fetchKajianList();
        fetchStats();
    }, [selectedStaffFilter, filterStartDate, filterEndDate]);

    // Search debounce
    useEffect(() => {
        const timeout = setTimeout(() => {
            fetchKajianList();
        }, 350);
        return () => clearTimeout(timeout);
    }, [searchQuery]);

    // Open Create Modal
    const handleOpenCreateModal = () => {
        setEditingItem(null);
        setFormData({
            userId: user?.id ? String(user.id) : (staffOptions[0]?.id ? String(staffOptions[0].id) : ''),
            date: dayjs().format('YYYY-MM-DD'),
            title: '',
            speaker: '',
            location: '',
            summary: ''
        });
        setSelectedPhoto(null);
        setPhotoPreview(null);
        setPhotoError('');
        setRemoveExistingPhoto(false);
        setShowModal(true);
    };

    // Open Edit Modal
    const handleOpenEditModal = (item) => {
        setEditingItem(item);
        setFormData({
            userId: item.userId ? String(item.userId) : (user?.id ? String(user.id) : ''),
            date: item.date ? dayjs(item.date).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
            title: item.title || '',
            speaker: item.speaker || '',
            location: item.location || '',
            summary: item.summary || ''
        });
        setSelectedPhoto(null);
        setPhotoPreview(item.photoUrl || null);
        setPhotoError('');
        setRemoveExistingPhoto(false);
        setShowModal(true);
    };

    // Handle Photo Selection
    const handlePhotoChange = (e) => {
        const file = e.target.files?.[0];
        setPhotoError('');
        if (!file) return;

        // Validasi tipe file
        const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            setPhotoError('Format foto harus berupa JPG, PNG, atau WEBP');
            return;
        }

        // Validasi ukuran file (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            setPhotoError('Ukuran file foto maksimal 5 MB');
            return;
        }

        setSelectedPhoto(file);
        setRemoveExistingPhoto(false);

        // Preview lokal
        const reader = new FileReader();
        reader.onloadend = () => {
            setPhotoPreview(reader.result);
        };
        reader.readAsDataURL(file);
    };

    const handleClearPhoto = () => {
        setSelectedPhoto(null);
        setPhotoPreview(null);
        setPhotoError('');
        setRemoveExistingPhoto(true);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Submit Form (Create / Edit)
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.title.trim()) {
            showToast('Judul kajian wajib diisi', 'error');
            return;
        }
        if (!formData.speaker.trim()) {
            showToast('Nama penceramah / ustadz wajib diisi', 'error');
            return;
        }
        if (!formData.location.trim()) {
            showToast('Lokasi kajian (Nama Masjid) wajib diisi', 'error');
            return;
        }

        try {
            setSubmitting(true);
            const form = new FormData();
            form.append('date', formData.date || dayjs().format('YYYY-MM-DD'));
            form.append('title', formData.title.trim());
            form.append('speaker', formData.speaker.trim());
            form.append('location', formData.location.trim());
            if (formData.summary) form.append('summary', formData.summary.trim());
            if (canManageAll && formData.userId) form.append('userId', formData.userId);

            if (selectedPhoto) {
                form.append('photo', selectedPhoto);
            } else if (removeExistingPhoto) {
                form.append('removePhoto', 'true');
            }

            if (editingItem) {
                await api.put(`/personnel/kajian/${editingItem.id}`, form, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                showToast('Data kehadiran kajian berhasil diperbarui!');
            } else {
                await api.post('/personnel/kajian', form, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                showToast('Kehadiran kajian berhasil dicatat!');
            }

            setShowModal(false);
            fetchKajianList();
            fetchStats();
        } catch (err) {
            console.error('Error saving kajian:', err);
            showToast(err.response?.data?.error || 'Gagal menyimpan data kehadiran kajian', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // Delete Kajian
    const handleDelete = async (id) => {
        if (!window.confirm('Apakah Anda yakin ingin menghapus data kehadiran kajian ini?')) return;
        try {
            setDeletingId(id);
            await api.delete(`/personnel/kajian/${id}`);
            showToast('Data kehadiran kajian berhasil dihapus');
            setKajianList(prev => prev.filter(k => k.id !== id));
            fetchStats();
        } catch (err) {
            console.error('Failed to delete kajian:', err);
            showToast(err.response?.data?.error || 'Gagal menghapus data kajian', 'error');
        } finally {
            setDeletingId(null);
        }
    };

    const handleResetFilters = () => {
        setSearchQuery('');
        setSelectedStaffFilter('ALL');
        setFilterStartDate('');
        setFilterEndDate('');
    };

    return (
        <div className="space-y-6">
            {/* TOAST FEEDBACK */}
            {feedback && (
                <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-sm font-semibold transition-all shadow-sm ${
                    feedback.type === 'error'
                        ? 'bg-rose-50 border-rose-200 text-rose-800'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}>
                    <div className="flex items-center gap-2">
                        {feedback.type === 'error' ? <AlertCircle size={18} className="shrink-0" /> : <CheckCircle2 size={18} className="shrink-0" />}
                        <span>{feedback.message}</span>
                    </div>
                    <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* STATS OVERVIEW CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                <div className="bg-gradient-to-br from-teal-500 to-teal-700 text-white p-4 rounded-2xl shadow-sm relative overflow-hidden">
                    <div className="absolute right-2 -bottom-2 text-teal-400/20">
                        <BookCheck size={72} />
                    </div>
                    <p className="text-xs font-medium text-teal-100 uppercase tracking-wider">Total Kehadiran</p>
                    <p className="text-2xl font-black mt-1">{stats.totalKajian}</p>
                    <p className="text-[11px] text-teal-100 mt-0.5">Sesi kajian tercatat</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Bulan Ini</span>
                        <Calendar size={18} className="text-teal-600" />
                    </div>
                    <p className="text-2xl font-black text-slate-800">{stats.thisMonthCount}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{dayjs().locale('id').format('MMMM YYYY')}</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Tahun Ini</span>
                        <Sparkles size={18} className="text-amber-500" />
                    </div>
                    <p className="text-2xl font-black text-slate-800">{stats.thisYearCount}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Tahun {dayjs().format('YYYY')}</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Masjid Dikunjungi</span>
                        <MapPin size={18} className="text-emerald-600" />
                    </div>
                    <p className="text-2xl font-black text-slate-800">{stats.uniqueLocations}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Lokasi / Masjid</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs col-span-2 md:col-span-1">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Penceramah</span>
                        <User size={18} className="text-indigo-600" />
                    </div>
                    <p className="text-2xl font-black text-slate-800">{stats.uniqueSpeakers}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Asatidz / Pemateri</p>
                </div>
            </div>

            {/* ACTION & FILTER TOOLBAR */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-teal-50 text-teal-700 rounded-xl">
                            <BookCheck size={20} />
                        </div>
                        <div>
                            <h2 className="text-base sm:text-lg font-bold text-slate-800">Daftar Kehadiran Kajian</h2>
                            <p className="text-xs text-slate-500">Pencatatan kehadiran kajian rutin & rohani staf sarpras</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => { fetchKajianList(); fetchStats(); }}
                            title="Segarkan data"
                            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-all cursor-pointer"
                        >
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </button>

                        <button
                            onClick={handleOpenCreateModal}
                            className="flex-1 md:flex-none px-4 py-2.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-sm shadow-teal-500/25 cursor-pointer"
                        >
                            <Plus size={16} />
                            <span>Catat Kehadiran Kajian</span>
                        </button>
                    </div>
                </div>

                {/* FILTERS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100">
                    {/* Search */}
                    <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Cari judul, ustadz, masjid..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                        />
                    </div>

                    {/* Staf Selector (if manager) */}
                    {canManageAll ? (
                        <div className="relative">
                            <select
                                value={selectedStaffFilter}
                                onChange={(e) => setSelectedStaffFilter(e.target.value)}
                                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white cursor-pointer"
                            >
                                <option value="ALL">Semua Staf ({staffOptions.length})</option>
                                {staffOptions.map(st => (
                                    <option key={st.id} value={st.id}>
                                        {st.name} {st.position ? `(${st.position})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <div className="flex items-center px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-600">
                            <User size={13} className="mr-2 text-slate-400" />
                            <span className="font-medium truncate">{user?.name || user?.username || 'Saya'}</span>
                        </div>
                    )}

                    {/* Date Range Start */}
                    <div>
                        <input
                            type="date"
                            value={filterStartDate}
                            onChange={(e) => setFilterStartDate(e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                            placeholder="Dari Tanggal"
                        />
                    </div>

                    {/* Date Range End & Reset */}
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={filterEndDate}
                            onChange={(e) => setFilterEndDate(e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                            placeholder="Sampai Tanggal"
                        />
                        {(searchQuery || selectedStaffFilter !== 'ALL' || filterStartDate || filterEndDate) && (
                            <button
                                onClick={handleResetFilters}
                                className="p-2 text-xs rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 shrink-0 cursor-pointer"
                                title="Reset filter"
                            >
                                <X size={15} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* LIST OF KAJIAN */}
            {loading ? (
                <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
                    <Loader2 size={32} className="animate-spin text-teal-600 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-slate-600">Memuat data kehadiran kajian...</p>
                </div>
            ) : kajianList.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-300">
                    <div className="w-14 h-14 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <BookCheck size={28} />
                    </div>
                    <h3 className="text-base font-bold text-slate-800 mb-1">Belum Ada Data Kehadiran Kajian</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                        Pencatatan kajian yang Anda hadiri akan tampil di sini sebagai arsip kehadiran rohani dan pengembangan diri.
                    </p>
                    <button
                        onClick={handleOpenCreateModal}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                    >
                        <Plus size={15} />
                        <span>Catat Kehadiran Sekarang</span>
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {kajianList.map((item) => {
                        const canModify = canManageAll || item.userId === user?.id;
                        return (
                            <div
                                key={item.id}
                                className="bg-white rounded-2xl border border-slate-200 hover:border-teal-300 hover:shadow-md transition-all flex flex-col overflow-hidden group"
                            >
                                {/* Top Banner / Header Info */}
                                <div className="p-4 sm:p-5 flex-1 flex flex-col">
                                    <div className="flex items-start justify-between gap-2 mb-2.5">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200/60 px-2.5 py-1 rounded-lg">
                                            <Calendar size={13} />
                                            <span>{dayjs(item.date).locale('id').format('dddd, D MMMM YYYY')}</span>
                                        </div>

                                        {item.photoUrl && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setPreviewPhotoUrl(item.photoUrl);
                                                    setPreviewPhotoTitle(item.title);
                                                }}
                                                className="flex items-center gap-1 text-[11px] font-semibold text-teal-600 hover:text-teal-800 bg-teal-50/80 hover:bg-teal-100 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                                                title="Lihat foto bukti"
                                            >
                                                <ImageIcon size={12} />
                                                <span>Foto</span>
                                            </button>
                                        )}
                                    </div>

                                    {/* Judul Kajian */}
                                    <h3
                                        onClick={() => setSelectedDetail(item)}
                                        className="text-base font-bold text-slate-800 group-hover:text-teal-700 transition-colors line-clamp-2 cursor-pointer mb-2"
                                        title={item.title}
                                    >
                                        {item.title}
                                    </h3>

                                    {/* Metadata: Penceramah & Lokasi Masjid */}
                                    <div className="space-y-1.5 mb-3 text-xs text-slate-600">
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 h-5 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                                <User size={12} />
                                            </div>
                                            <span className="font-semibold text-slate-700 truncate" title={item.speaker}>
                                                {item.speaker}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 h-5 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                                <MapPin size={12} />
                                            </div>
                                            <span className="text-slate-600 truncate" title={item.location}>
                                                {item.location}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Rangkuman Excerpt */}
                                    {item.summary ? (
                                        <div
                                            onClick={() => setSelectedDetail(item)}
                                            className="bg-slate-50/80 hover:bg-slate-100/80 rounded-xl p-2.5 text-xs text-slate-600 border border-slate-100 cursor-pointer transition-colors mb-3"
                                        >
                                            <p className="line-clamp-3 leading-relaxed italic">
                                                "{item.summary}"
                                            </p>
                                            <span className="text-[10px] font-bold text-teal-600 hover:underline inline-block mt-1">
                                                Baca rangkuman lengkap →
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="text-[11px] text-slate-400 italic mb-3">
                                            Tidak ada rangkuman materi
                                        </div>
                                    )}

                                    {/* Staff Name Tag (if manager view) */}
                                    {canManageAll && item.user && (
                                        <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                                            <div className="flex items-center gap-1.5 truncate">
                                                <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                                                    {(item.user.name || item.user.username || 'U')[0].toUpperCase()}
                                                </div>
                                                <span className="font-medium text-slate-700 truncate">
                                                    {item.user.name || item.user.username}
                                                </span>
                                            </div>
                                            <span className="text-slate-400 text-[10px] shrink-0">
                                                {item.user.unit?.name || item.user.position || 'Staf'}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Bottom Actions Bar */}
                                <div className="px-4 py-2.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedDetail(item)}
                                        className="text-xs font-semibold text-slate-600 hover:text-teal-700 flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <Eye size={13} />
                                        <span>Detail</span>
                                    </button>

                                    {canModify && (
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => handleOpenEditModal(item)}
                                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                                title="Edit kehadiran kajian"
                                            >
                                                <Edit3 size={14} />
                                            </button>
                                            <button
                                                type="button"
                                                disabled={deletingId === item.id}
                                                onClick={() => handleDelete(item.id)}
                                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                                title="Hapus data kajian"
                                            >
                                                {deletingId === item.id ? (
                                                    <Loader2 size={14} className="animate-spin text-rose-600" />
                                                ) : (
                                                    <Trash2 size={14} />
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* MODAL: FORM CATAT / EDIT KEHADIRAN KAJIAN */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
                    <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
                        {/* Modal Header */}
                        <div className="px-6 py-4.5 bg-gradient-to-r from-teal-600 to-teal-700 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-white/10 rounded-xl">
                                    <BookCheck size={20} />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold">
                                        {editingItem ? 'Edit Kehadiran Kajian' : 'Catat Kehadiran Kajian'}
                                    </h3>
                                    <p className="text-xs text-teal-100">
                                        {editingItem ? 'Perbarui informasi sesi kajian' : 'Isi formulir kehadiran kajian dengan lengkap'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => !submitting && setShowModal(false)}
                                className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body Form */}
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {/* Staf Selector (if manager) */}
                            {canManageAll && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                        Staf Peserta Kajian <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        value={formData.userId}
                                        onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                                        className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                                        required
                                    >
                                        {staffOptions.map(st => (
                                            <option key={st.id} value={st.id}>
                                                {st.name} {st.position ? `(${st.position})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Tanggal Kajian (Automatis atau bisa edit) */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-xs font-bold text-slate-700">
                                        Tanggal Kajian <span className="text-rose-500">*</span>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, date: dayjs().format('YYYY-MM-DD') })}
                                        className="text-[11px] font-semibold text-teal-600 hover:text-teal-800 transition-colors"
                                    >
                                        Gunakan Hari Ini
                                    </button>
                                </div>
                                <div className="relative">
                                    <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    <input
                                        type="date"
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        className="w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                                        required
                                    />
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">Otomatis terisi tanggal hari ini, dapat diubah sesuai tanggal pelaksanaan kajian.</p>
                            </div>

                            {/* Judul Kajian */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Judul Kajian <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="Contoh: Fiqih Muamalah & Adab Bekerja dalam Islam"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                    required
                                />
                            </div>

                            {/* Penceramah & Lokasi Masjid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                        Penceramah / Ustadz <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Contoh: Ustadz Dr. Khalid Basalamah"
                                            value={formData.speaker}
                                            onChange={(e) => setFormData({ ...formData, speaker: e.target.value })}
                                            className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                        Lokasi Kajian (Nama Masjid) <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Contoh: Masjid Agung Al-Azhar"
                                            value={formData.location}
                                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                            className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Rangkuman (Opsional) */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Rangkuman Kajian <span className="text-slate-400 font-normal">(Opsional)</span>
                                </label>
                                <textarea
                                    rows={4}
                                    placeholder="Tuliskan intisari, faedah, atau catatan materi kajian yang disampaikan..."
                                    value={formData.summary}
                                    onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                />
                            </div>

                            {/* Foto Bukti Kehadiran (Opsional) */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Foto Bukti Kehadiran <span className="text-slate-400 font-normal">(Opsional)</span>
                                </label>

                                {photoPreview ? (
                                    <div className="relative p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-3">
                                        <img
                                            src={photoPreview}
                                            alt="Preview Foto Kajian"
                                            className="w-16 h-16 rounded-xl object-cover border border-slate-200 bg-white"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-slate-800 truncate">
                                                {selectedPhoto ? selectedPhoto.name : 'Foto Tersimpan'}
                                            </p>
                                            <p className="text-[11px] text-slate-400">
                                                {selectedPhoto ? `${(selectedPhoto.size / 1024).toFixed(0)} KB` : 'Foto diunggah sebelumnya'}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleClearPhoto}
                                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                            title="Hapus foto"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="border-2 border-dashed border-slate-200 hover:border-teal-400 hover:bg-teal-50/30 rounded-2xl p-4 text-center cursor-pointer transition-all"
                                    >
                                        <ImageIcon size={28} className="mx-auto text-slate-400 mb-1" />
                                        <p className="text-xs font-semibold text-slate-700">Pilih Foto atau Dokumen Gambar</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">Format JPG, PNG, WEBP (Maksimal 5 MB)</p>
                                    </div>
                                )}

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handlePhotoChange}
                                    className="hidden"
                                />

                                {photoError && (
                                    <p className="text-xs text-rose-500 font-medium mt-1">{photoError}</p>
                                )}
                            </div>

                            {/* Action Buttons */}
                            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                                <button
                                    type="button"
                                    disabled={submitting}
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-5 py-2.5 text-xs font-bold bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 size={15} className="animate-spin" />
                                            <span>Menyimpan...</span>
                                        </>
                                    ) : (
                                        <>
                                            <BookCheck size={15} />
                                            <span>{editingItem ? 'Simpan Perubahan' : 'Catat Kehadiran'}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: DETAIL KEHADIRAN KAJIAN */}
            {selectedDetail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
                    <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
                        {/* Header */}
                        <div className="px-6 py-4.5 bg-gradient-to-r from-teal-600 to-teal-700 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-white/10 rounded-xl">
                                    <BookCheck size={20} />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold">Detail Kehadiran Kajian</h3>
                                    <p className="text-xs text-teal-100">Informasi lengkap sesi kajian</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedDetail(null)}
                                className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-4">
                            <div>
                                <div className="flex items-center gap-1.5 text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200/60 px-2.5 py-1 rounded-lg w-fit mb-2">
                                    <Calendar size={13} />
                                    <span>{dayjs(selectedDetail.date).locale('id').format('dddd, D MMMM YYYY')}</span>
                                </div>
                                <h2 className="text-lg font-bold text-slate-800 leading-snug">
                                    {selectedDetail.title}
                                </h2>
                            </div>

                            {/* Speaker & Location Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Penceramah / Ustadz</p>
                                    <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                        <User size={13} className="text-indigo-600 shrink-0" />
                                        <span className="truncate">{selectedDetail.speaker}</span>
                                    </p>
                                </div>

                                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Lokasi Kajian</p>
                                    <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                        <MapPin size={13} className="text-emerald-600 shrink-0" />
                                        <span className="truncate">{selectedDetail.location}</span>
                                    </p>
                                </div>
                            </div>

                            {/* Staff Info */}
                            {selectedDetail.user && (
                                <div className="p-3 bg-teal-50/50 rounded-2xl border border-teal-100 flex items-center justify-between text-xs">
                                    <div>
                                        <p className="text-[10px] text-teal-600 font-semibold uppercase">Peserta Kajian</p>
                                        <p className="font-bold text-slate-800">{selectedDetail.user.name || selectedDetail.user.username}</p>
                                    </div>
                                    <span className="text-[11px] text-slate-500 font-medium">
                                        {selectedDetail.user.unit?.name || selectedDetail.user.position || 'Staf'}
                                    </span>
                                </div>
                            )}

                            {/* Summary */}
                            <div>
                                <h4 className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                                    <FileText size={14} className="text-teal-600" />
                                    <span>Rangkuman / Catatan Kajian</span>
                                </h4>
                                {selectedDetail.summary ? (
                                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                                        {selectedDetail.summary}
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-400 italic">Tidak ada rangkuman materi kajian.</p>
                                )}
                            </div>

                            {/* Foto Bukti */}
                            {selectedDetail.photoUrl && (
                                <div>
                                    <h4 className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                                        <ImageIcon size={14} className="text-teal-600" />
                                        <span>Foto Bukti Kehadiran</span>
                                    </h4>
                                    <div
                                        onClick={() => {
                                            setPreviewPhotoUrl(selectedDetail.photoUrl);
                                            setPreviewPhotoTitle(selectedDetail.title);
                                        }}
                                        className="relative rounded-2xl overflow-hidden border border-slate-200 cursor-pointer group max-h-56 bg-slate-100"
                                    >
                                        <img
                                            src={selectedDetail.photoUrl}
                                            alt="Foto Kehadiran Kajian"
                                            className="w-full h-48 object-cover group-hover:scale-102 transition-transform duration-200"
                                        />
                                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1.5">
                                            <Eye size={16} />
                                            <span>Klik untuk perbesar</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Footer Buttons */}
                            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={() => setSelectedDetail(null)}
                                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                                >
                                    Tutup
                                </button>
                                {(canManageAll || selectedDetail.userId === user?.id) && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const itemToEdit = selectedDetail;
                                            setSelectedDetail(null);
                                            handleOpenEditModal(itemToEdit);
                                        }}
                                        className="px-4 py-2 text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <Edit3 size={13} />
                                        <span>Edit Data Ini</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: PHOTO FULL VIEWER */}
            {previewPhotoUrl && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
                    <div className="bg-slate-900 rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="px-5 py-3.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-white">
                            <div className="flex items-center gap-2 truncate pr-4">
                                <ImageIcon size={18} className="text-teal-400 shrink-0" />
                                <span className="text-xs sm:text-sm font-bold truncate">
                                    {previewPhotoTitle || 'Foto Bukti Kehadiran Kajian'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <a
                                    href={previewPhotoUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    download
                                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                                    title="Unduh / Buka di Tab Baru"
                                >
                                    <ExternalLink size={16} />
                                </a>
                                <button
                                    onClick={() => setPreviewPhotoUrl(null)}
                                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Image Body */}
                        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/40 min-h-[300px]">
                            <img
                                src={previewPhotoUrl}
                                alt="Foto Kajian"
                                className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-lg"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

