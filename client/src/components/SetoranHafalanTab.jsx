import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    BookOpen, Sparkles, RotateCcw, Calendar, User, Search, Filter, 
    Plus, Edit2, Trash2, Save, X, AlertCircle, Award, CheckCircle2, 
    Book, ChevronDown, Check, Loader2, RefreshCw, Hash, ArrowRight,
    TrendingUp, FileText, Share2
} from 'lucide-react';
import dayjs from 'dayjs';
import api from '../lib/axios';
import { 
    QURAN_SURAHS, 
    JUZ_LIST, 
    getSurahsByJuz, 
    getSurahByNumber, 
    validateAyatRange, 
    PREDIKAT_OPTIONS 
} from '../lib/quranData';

const SetoranHafalanTab = ({ isKabid, user }) => {
    // Data states
    const [records, setRecords] = useState([]);
    const [stats, setStats] = useState({
        totalSetoran: 0,
        totalZiyadah: 0,
        totalMurajaah: 0,
        totalAyat: 0,
        latestRecord: null
    });
    const [staffList, setStaffList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', text: '' }

    // Filter states
    const [selectedStaffFilter, setSelectedStaffFilter] = useState('ALL');
    const [filterTipe, setFilterTipe] = useState('ALL'); // 'ALL' | 'Ziyadah' | 'Murajaah'
    const [filterJuz, setFilterJuz] = useState('ALL'); // 'ALL' | 1..30
    const [searchQuery, setSearchQuery] = useState('');

    // Toggle Form visibility
    const [showForm, setShowForm] = useState(false);

    // Form states for New Setoran
    const [formData, setFormData] = useState({
        staffId: user?.id || '',
        tipeSetoran: 'Ziyadah', // 'Ziyadah' | 'Murajaah'
        juz: 30,
        surahNumber: 78,
        surah: "An-Naba'",
        ayatAwal: 1,
        ayatAkhir: 40,
        pembimbing: '',
        nilai: 'Mumtaz',
        catatan: '',
        tanggalSetoran: dayjs().format('YYYY-MM-DD')
    });

    // Surah selector dropdown open state
    const [isSurahDropdownOpen, setIsSurahDropdownOpen] = useState(false);
    const [surahSearchTerm, setSurahSearchTerm] = useState('');
    const surahDropdownRef = useRef(null);

    // Edit Modal states
    const [editingRecord, setEditingRecord] = useState(null);
    const [editFormData, setEditFormData] = useState(null);
    const [isEditSurahDropdownOpen, setIsEditSurahDropdownOpen] = useState(false);
    const [editSurahSearchTerm, setEditSurahSearchTerm] = useState('');
    const editSurahDropdownRef = useRef(null);

    // Delete confirmation modal state
    const [deletingRecord, setDeletingRecord] = useState(null);

    // Close surah dropdowns on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (surahDropdownRef.current && !surahDropdownRef.current.contains(e.target)) {
                setIsSurahDropdownOpen(false);
            }
            if (editSurahDropdownRef.current && !editSurahDropdownRef.current.contains(e.target)) {
                setIsEditSurahDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch Staff List (if Kabid)
    useEffect(() => {
        if (isKabid) {
            const fetchStaff = async () => {
                try {
                    const res = await api.get('/personnel/users');
                    if (res.data && Array.isArray(res.data)) {
                        const filtered = res.data.filter(u => u.role === 'ADMIN_ASET' && !u.position?.toLowerCase().includes('kepala bidang'));
                        setStaffList(filtered);
                    }
                } catch (e) {
                    console.warn('Gagal memuat daftar staf:', e);
                }
            };
            fetchStaff();
        }
    }, [isKabid]);

    // Fetch Records & Stats
    const fetchData = async () => {
        setLoading(true);
        try {
            const params = {};
            if (isKabid && selectedStaffFilter !== 'ALL') {
                params.staffId = selectedStaffFilter;
            }
            if (filterTipe !== 'ALL') {
                params.tipe = filterTipe;
            }
            if (filterJuz !== 'ALL') {
                params.juz = filterJuz;
            }
            if (searchQuery.trim()) {
                params.search = searchQuery.trim();
            }

            const [recordsRes, statsRes] = await Promise.all([
                api.get('/laporan/hafalan', { params }),
                api.get('/laporan/hafalan/stats', { 
                    params: (isKabid && selectedStaffFilter !== 'ALL') ? { staffId: selectedStaffFilter } : {} 
                })
            ]);

            if (recordsRes.data && recordsRes.data.records) {
                setRecords(recordsRes.data.records);
            }
            if (statsRes.data && statsRes.data.stats) {
                setStats(statsRes.data.stats);
            }
        } catch (error) {
            console.error('Error fetching hafalan data:', error);
            setFeedback({ type: 'error', text: 'Gagal memuat data setoran hafalan.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedStaffFilter, filterTipe, filterJuz]);

    // Handle search with debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchData();
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // List of Surahs available for the currently chosen Juz in Add Form
    const availableSurahsInAddForm = useMemo(() => {
        let list = getSurahsByJuz(formData.juz);
        if (surahSearchTerm.trim()) {
            const term = surahSearchTerm.toLowerCase();
            list = list.filter(s => 
                s.name.toLowerCase().includes(term) || 
                s.translation.toLowerCase().includes(term) || 
                String(s.number).includes(term)
            );
        }
        return list;
    }, [formData.juz, surahSearchTerm]);

    // Selected Surah Object for Add Form
    const currentSurahObj = useMemo(() => {
        return getSurahByNumber(formData.surahNumber) || QURAN_SURAHS[77]; // default An-Naba'
    }, [formData.surahNumber]);

    // Validation for Add Form
    const addFormValidation = useMemo(() => {
        return validateAyatRange(formData.surahNumber, formData.ayatAwal, formData.ayatAkhir);
    }, [formData.surahNumber, formData.ayatAwal, formData.ayatAkhir]);

    // Handle Juz Change in Add Form
    const handleJuzChange = (newJuz) => {
        const jNum = parseInt(newJuz, 10);
        const surahsInJuz = getSurahsByJuz(jNum);
        const firstSurah = surahsInJuz[0] || QURAN_SURAHS[0];
        setFormData(prev => ({
            ...prev,
            juz: jNum,
            surahNumber: firstSurah.number,
            surah: firstSurah.name,
            ayatAwal: 1,
            ayatAkhir: firstSurah.totalVerses
        }));
    };

    // Handle Surah Select in Add Form
    const handleSelectSurah = (surah) => {
        setFormData(prev => ({
            ...prev,
            surahNumber: surah.number,
            surah: surah.name,
            juz: surah.juz[0] || prev.juz,
            ayatAwal: 1,
            ayatAkhir: surah.totalVerses
        }));
        setIsSurahDropdownOpen(false);
        setSurahSearchTerm('');
    };

    // Submit New Setoran
    const handleCreateSetoran = async (e) => {
        e.preventDefault();
        if (!addFormValidation.isValid) {
            setFeedback({ type: 'error', text: addFormValidation.message });
            return;
        }

        setSubmitting(true);
        setFeedback(null);

        try {
            const payload = {
                ...formData,
                staffId: isKabid ? formData.staffId : user.id,
                totalAyat: addFormValidation.totalAyat
            };

            const res = await api.post('/laporan/hafalan', payload);
            if (res.data && res.data.success) {
                setFeedback({ type: 'success', text: 'Alhamdulillah, setoran hafalan berhasil dicatat!' });
                setShowForm(false);
                // Reset form or keep common fields
                setFormData(prev => ({
                    ...prev,
                    ayatAwal: 1,
                    ayatAkhir: currentSurahObj.totalVerses,
                    catatan: ''
                }));
                fetchData();
            }
        } catch (err) {
            console.error('Error creating setoran:', err);
            const msg = err.response?.data?.error || 'Gagal menyimpan setoran hafalan.';
            setFeedback({ type: 'error', text: msg });
        } finally {
            setSubmitting(false);
        }
    };

    // Start Editing a Record
    const handleStartEdit = (record) => {
        setEditingRecord(record);
        setEditFormData({
            id: record.id,
            tipeSetoran: record.tipeSetoran || 'Ziyadah',
            juz: record.juz || 30,
            surahNumber: record.surahNumber || 78,
            surah: record.surah || "An-Naba'",
            ayatAwal: record.ayatAwal || 1,
            ayatAkhir: record.ayatAkhir || 1,
            pembimbing: record.pembimbing || '',
            nilai: record.nilai || 'Mumtaz',
            catatan: record.catatan || '',
            tanggalSetoran: dayjs(record.date).format('YYYY-MM-DD')
        });
        setEditSurahSearchTerm('');
    };

    // Edit form validation
    const editFormValidation = useMemo(() => {
        if (!editFormData) return { isValid: true };
        return validateAyatRange(editFormData.surahNumber, editFormData.ayatAwal, editFormData.ayatAkhir);
    }, [editFormData]);

    // Available Surahs for Edit Form
    const availableSurahsInEditForm = useMemo(() => {
        if (!editFormData) return [];
        let list = getSurahsByJuz(editFormData.juz);
        if (editSurahSearchTerm.trim()) {
            const term = editSurahSearchTerm.toLowerCase();
            list = list.filter(s => 
                s.name.toLowerCase().includes(term) || 
                s.translation.toLowerCase().includes(term) || 
                String(s.number).includes(term)
            );
        }
        return list;
    }, [editFormData?.juz, editSurahSearchTerm]);

    // Submit Edit Record
    const handleUpdateSetoran = async (e) => {
        e.preventDefault();
        if (!editFormValidation.isValid) {
            alert(editFormValidation.message);
            return;
        }

        setSubmitting(true);
        try {
            const res = await api.put(`/laporan/hafalan/${editFormData.id}`, {
                ...editFormData,
                totalAyat: editFormValidation.totalAyat
            });
            if (res.data && res.data.success) {
                setFeedback({ type: 'success', text: 'Data setoran hafalan berhasil diperbarui.' });
                setEditingRecord(null);
                setEditFormData(null);
                fetchData();
            }
        } catch (err) {
            console.error('Error updating setoran:', err);
            alert(err.response?.data?.error || 'Gagal memperbarui setoran hafalan.');
        } finally {
            setSubmitting(false);
        }
    };

    // Delete Record
    const handleConfirmDelete = async () => {
        if (!deletingRecord) return;
        setSubmitting(true);
        try {
            const res = await api.delete(`/laporan/hafalan/${deletingRecord.id}`);
            if (res.data && res.data.success) {
                setFeedback({ type: 'success', text: 'Data setoran hafalan berhasil dihapus.' });
                setDeletingRecord(null);
                fetchData();
            }
        } catch (err) {
            console.error('Error deleting setoran:', err);
            alert(err.response?.data?.error || 'Gagal menghapus setoran hafalan.');
        } finally {
            setSubmitting(false);
        }
    };

    // Helper for predicate badge color
    const getPredikatBadge = (nilai) => {
        switch (nilai) {
            case 'Mumtaz':
                return 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold';
            case 'Jayyid Jiddan':
                return 'bg-blue-50 text-blue-700 border-blue-200 font-bold';
            case 'Jayyid':
                return 'bg-amber-50 text-amber-700 border-amber-200 font-bold';
            case 'Maqbul':
                return 'bg-rose-50 text-rose-700 border-rose-200 font-bold';
            default:
                return 'bg-slate-50 text-slate-700 border-slate-200 font-medium';
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300 pb-12">
            {/* Feedback Alert Banner */}
            {feedback && (
                <div className={`p-4 rounded-2xl border flex items-center justify-between shadow-sm transition-all ${
                    feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                    <div className="flex items-center gap-3">
                        {feedback.type === 'success' ? <CheckCircle2 className="text-emerald-600" size={20} /> : <AlertCircle className="text-rose-600" size={20} />}
                        <span className="text-xs sm:text-sm font-semibold">{feedback.text}</span>
                    </div>
                    <button 
                        onClick={() => setFeedback(null)} 
                        className="p-1 hover:bg-black/5 rounded-lg text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* HEADER & QUICK ACTION BAR */}
            <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
                {/* Islamic Geometric decorative background SVG overlay */}
                <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 pointer-events-none flex items-center justify-center">
                    <BookOpen size={220} />
                </div>

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2 max-w-xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-400/30 backdrop-blur-md">
                            <Sparkles size={14} />
                            <span>Program Tahfiz & Pembinaan Rohani Staff Sarpras</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
                            <BookOpen className="text-emerald-400" size={32} />
                            Setoran Hafalan Al-Qur'an
                        </h2>
                        <p className="text-xs sm:text-sm text-emerald-100/80 leading-relaxed">
                            Catat progres hafalan baru (<span className="text-emerald-300 font-bold">Ziyadah</span>) dan pengulangan berkala (<span className="text-teal-200 font-bold">Murajaah</span>) dengan akurasi ayat dan juz terdata otomatis.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            onClick={() => {
                                setShowForm(prev => !prev);
                                setFeedback(null);
                            }}
                            className={`px-5 py-3 rounded-2xl text-xs sm:text-sm font-black transition-all flex items-center gap-2.5 cursor-pointer shadow-lg active:scale-95 ${
                                showForm 
                                    ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20' 
                                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/30 hover:shadow-emerald-500/40'
                            }`}
                        >
                            {showForm ? (
                                <>
                                    <X size={18} /> Tutup Form Input
                                </>
                            ) : (
                                <>
                                    <Plus size={18} strokeWidth={3} /> Catat Setoran Baru
                                </>
                            )}
                        </button>

                        <button
                            onClick={fetchData}
                            className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl border border-white/20 transition-all cursor-pointer"
                            title="Segarkan Data"
                        >
                            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>
            </div>

            {/* STATS OVERVIEW CARDS */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* Card 1: Total Setoran */}
                <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center gap-4 hover:border-emerald-300 transition-all">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <BookOpen size={24} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Setoran</p>
                        <h4 className="text-xl sm:text-2xl font-black text-slate-800">{stats.totalSetoran} <span className="text-xs font-semibold text-slate-500">kali</span></h4>
                    </div>
                </div>

                {/* Card 2: Ziyadah */}
                <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center gap-4 hover:border-emerald-300 transition-all">
                    <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                        <Sparkles size={24} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Ziyadah (Baru)</p>
                        <h4 className="text-xl sm:text-2xl font-black text-teal-700">{stats.totalZiyadah} <span className="text-xs font-semibold text-slate-500">kali</span></h4>
                    </div>
                </div>

                {/* Card 3: Murajaah */}
                <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center gap-4 hover:border-emerald-300 transition-all">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <RotateCcw size={24} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Murajaah (Ulang)</p>
                        <h4 className="text-xl sm:text-2xl font-black text-blue-700">{stats.totalMurajaah} <span className="text-xs font-semibold text-slate-500">kali</span></h4>
                    </div>
                </div>

                {/* Card 4: Total Ayat Disetor */}
                <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-sm flex items-center gap-4 hover:border-emerald-300 transition-all">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                        <Award size={24} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Ayat Disetor</p>
                        <h4 className="text-xl sm:text-2xl font-black text-amber-600">{stats.totalAyat.toLocaleString()} <span className="text-xs font-semibold text-slate-500">ayat</span></h4>
                    </div>
                </div>
            </div>

            {/* FORM INPUT SETORAN BARU (Expandable) */}
            {showForm && (
                <div className="bg-white rounded-3xl border border-emerald-200 shadow-xl overflow-hidden animate-in slide-in-from-top-4 duration-300">
                    <div className="p-5 sm:p-6 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
                                <Plus size={20} strokeWidth={3} />
                            </div>
                            <div>
                                <h3 className="text-base sm:text-lg font-black text-slate-800">Formulir Catat Setoran Hafalan</h3>
                                <p className="text-xs text-slate-500">Lengkapi data surah, rentang ayat, dan evaluasi penyimak</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowForm(false)}
                            className="p-2 hover:bg-slate-200/60 rounded-xl text-slate-400 hover:text-slate-700 transition-all cursor-pointer"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleCreateSetoran} className="p-5 sm:p-7 space-y-6">
                        {/* 1. Tipe Setoran & Petugas / Staff (Segmented) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {/* Pilihan Tipe Setoran: Ziyadah / Murajaah */}
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-700 tracking-wide flex items-center gap-1.5">
                                    <Sparkles size={14} className="text-emerald-600" />
                                    PILIHAN TIPE SETORAN <span className="text-rose-500">*</span>
                                </label>
                                <div className="grid grid-cols-2 gap-3 p-1 bg-slate-100 rounded-2xl border border-slate-200">
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, tipeSetoran: 'Ziyadah' }))}
                                        className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                            formData.tipeSetoran === 'Ziyadah'
                                                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                                        }`}
                                    >
                                        <Sparkles size={16} />
                                        <span>Ziyadah (Hafalan Baru)</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, tipeSetoran: 'Murajaah' }))}
                                        className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                            formData.tipeSetoran === 'Murajaah'
                                                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                                        }`}
                                    >
                                        <RotateCcw size={16} />
                                        <span>Murajaah (Pengulangan)</span>
                                    </button>
                                </div>
                            </div>

                            {/* Staf Penyetor (If Kabid: Dropdown, If Staff: Fixed Name) */}
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-700 tracking-wide flex items-center gap-1.5">
                                    <User size={14} className="text-emerald-600" />
                                    NAMA STAF PENYETOR <span className="text-rose-500">*</span>
                                </label>
                                {isKabid ? (
                                    <select
                                        value={formData.staffId}
                                        onChange={(e) => setFormData(prev => ({ ...prev, staffId: e.target.value }))}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all cursor-pointer"
                                        required
                                    >
                                        <option value={user?.id}>Saya Sendiri ({user?.name || user?.username})</option>
                                        {staffList.map(st => (
                                            <option key={st.id} value={st.id}>
                                                {st.name} ({st.position || 'Staff Aset'})
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold text-slate-700 flex items-center justify-between">
                                        <span>{user?.name || user?.username || 'Saya'}</span>
                                        <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md uppercase tracking-wider font-semibold">Staff Aktif</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 2. Pilih Juz & Pilih Surah */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                            {/* Pilih Juz (1 - 30) */}
                            <div className="md:col-span-4 space-y-2">
                                <label className="text-xs font-black text-slate-700 tracking-wide flex items-center gap-1.5">
                                    <Book size={14} className="text-emerald-600" />
                                    PILIH JUZ (1 - 30) <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    value={formData.juz}
                                    onChange={(e) => handleJuzChange(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all cursor-pointer"
                                >
                                    {JUZ_LIST.map(j => (
                                        <option key={j.number} value={j.number}>
                                            {j.description}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-[11px] text-slate-400">
                                    Pilihan Juz memfilter daftar surah di sebelah kanan
                                </p>
                            </div>

                            {/* Pilih Surah (Interactive Dropdown with Search & Arabic script) */}
                            <div className="md:col-span-8 space-y-2 relative" ref={surahDropdownRef}>
                                <label className="text-xs font-black text-slate-700 tracking-wide flex items-center justify-between">
                                    <span className="flex items-center gap-1.5">
                                        <BookOpen size={14} className="text-emerald-600" />
                                        PILIH SURAH <span className="text-rose-500">*</span>
                                    </span>
                                    <span className="text-[11px] text-emerald-600 font-bold">
                                        Total {currentSurahObj.totalVerses} Ayat
                                    </span>
                                </label>

                                <button
                                    type="button"
                                    onClick={() => setIsSurahDropdownOpen(prev => !prev)}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold text-slate-800 flex items-center justify-between hover:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-left cursor-pointer"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 text-xs font-black flex items-center justify-center">
                                            {currentSurahObj.number}
                                        </span>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-slate-900">{currentSurahObj.name}</span>
                                                <span className="text-xs text-slate-400 font-normal">({currentSurahObj.translation})</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <span className="text-base font-arabic text-emerald-800 font-semibold px-2 py-0.5 bg-emerald-50/80 rounded-lg">
                                            {currentSurahObj.arabic}
                                        </span>
                                        <ChevronDown size={16} className={`text-slate-400 transition-transform ${isSurahDropdownOpen ? 'rotate-180' : ''}`} />
                                    </div>
                                </button>

                                {/* Dropdown Menu */}
                                {isSurahDropdownOpen && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 z-30 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                                        <div className="p-3 border-b border-slate-100 bg-slate-50">
                                            <div className="relative">
                                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input
                                                    type="text"
                                                    value={surahSearchTerm}
                                                    onChange={(e) => setSurahSearchTerm(e.target.value)}
                                                    placeholder="Cari nomor atau nama surah..."
                                                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                                    autoFocus
                                                />
                                            </div>
                                        </div>

                                        <div className="max-h-60 overflow-y-auto p-1.5 divide-y divide-slate-50 custom-scrollbar">
                                            {availableSurahsInAddForm.length === 0 ? (
                                                <div className="p-4 text-center text-xs text-slate-400">
                                                    Tidak ada surah yang cocok dalam Juz {formData.juz}.
                                                </div>
                                            ) : (
                                                availableSurahsInAddForm.map(s => (
                                                    <button
                                                        key={s.number}
                                                        type="button"
                                                        onClick={() => handleSelectSurah(s)}
                                                        className={`w-full p-2.5 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer ${
                                                            s.number === formData.surahNumber
                                                                ? 'bg-emerald-50 text-emerald-900 font-bold'
                                                                : 'hover:bg-slate-50 text-slate-700'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2.5">
                                                            <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-bold flex items-center justify-center">
                                                                {s.number}
                                                            </span>
                                                            <div>
                                                                <p className="text-xs font-bold">{s.name}</p>
                                                                <p className="text-[10px] text-slate-400">{s.translation} • {s.totalVerses} ayat</p>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-arabic text-slate-600">
                                                                {s.arabic}
                                                            </span>
                                                            {s.number === formData.surahNumber && (
                                                                <Check size={16} className="text-emerald-600" />
                                                            )}
                                                        </div>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 3. Dari Ayat ke Ayat (Rentang Input) */}
                        <div className="bg-slate-50/80 rounded-2xl p-4 sm:p-5 border border-slate-200/80 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                    <label className="text-xs font-black text-slate-700 tracking-wide flex items-center gap-1.5">
                                        <Hash size={14} className="text-emerald-600" />
                                        RENTANG AYAT (DARI AYAT KE AYAT) <span className="text-rose-500">*</span>
                                    </label>
                                    <p className="text-[11px] text-slate-500">
                                        Masukkan nomor ayat awal dan akhir dari Surah {currentSurahObj.name}
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({
                                        ...prev,
                                        ayatAwal: 1,
                                        ayatAkhir: currentSurahObj.totalVerses
                                    }))}
                                    className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-xl text-[11px] font-bold transition-all self-start sm:self-auto cursor-pointer"
                                >
                                    Pilih Seluruh Surah (1 - {currentSurahObj.totalVerses})
                                </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Dari Ayat */}
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase">
                                        Dari Ayat
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            min="1"
                                            max={currentSurahObj.totalVerses}
                                            value={formData.ayatAwal}
                                            onChange={(e) => setFormData(prev => ({ ...prev, ayatAwal: parseInt(e.target.value, 10) || '' }))}
                                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                            required
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                                            / {currentSurahObj.totalVerses}
                                        </span>
                                    </div>
                                </div>

                                {/* Ke Ayat */}
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase">
                                        Ke Ayat
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            min="1"
                                            max={currentSurahObj.totalVerses}
                                            value={formData.ayatAkhir}
                                            onChange={(e) => setFormData(prev => ({ ...prev, ayatAkhir: parseInt(e.target.value, 10) || '' }))}
                                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                            required
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                                            / {currentSurahObj.totalVerses}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Validation & Total Ayat Pill */}
                            <div className="pt-1 flex items-center justify-between">
                                {addFormValidation.isValid ? (
                                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-100/70 text-emerald-800 text-xs font-bold">
                                        <CheckCircle2 size={14} className="text-emerald-600" />
                                        <span>Total yang disetor: {addFormValidation.totalAyat} Ayat (Ayat {formData.ayatAwal} s/d {formData.ayatAkhir})</span>
                                    </div>
                                ) : (
                                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-100 text-rose-800 text-xs font-bold">
                                        <AlertCircle size={14} className="text-rose-600" />
                                        <span>{addFormValidation.message}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 4. Tanggal, Penyimak/Pembimbing & Predikat Kelancaran */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                            {/* Tanggal Setoran */}
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-700 tracking-wide flex items-center gap-1.5">
                                    <Calendar size={14} className="text-emerald-600" />
                                    TANGGAL SETORAN <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={formData.tanggalSetoran}
                                    onChange={(e) => setFormData(prev => ({ ...prev, tanggalSetoran: e.target.value }))}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all cursor-pointer"
                                    required
                                />
                            </div>

                            {/* Pembimbing / Penyimak */}
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-700 tracking-wide flex items-center gap-1.5">
                                    <User size={14} className="text-emerald-600" />
                                    PENYIMAK / USTADZ
                                </label>
                                <input
                                    type="text"
                                    value={formData.pembimbing}
                                    onChange={(e) => setFormData(prev => ({ ...prev, pembimbing: e.target.value }))}
                                    placeholder="Contoh: Ustadz Ahmad / Kabid"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                                />
                            </div>

                            {/* Predikat Kelancaran */}
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-700 tracking-wide flex items-center gap-1.5">
                                    <Award size={14} className="text-emerald-600" />
                                    PREDIKAT KELANCARAN
                                </label>
                                <select
                                    value={formData.nilai}
                                    onChange={(e) => setFormData(prev => ({ ...prev, nilai: e.target.value }))}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all cursor-pointer"
                                >
                                    {PREDIKAT_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* 5. Catatan / Evaluasi Tajwid */}
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-700 tracking-wide flex items-center gap-1.5">
                                <FileText size={14} className="text-emerald-600" />
                                CATATAN / EVALUASI TAJWID & MAKHRAJ
                            </label>
                            <textarea
                                value={formData.catatan}
                                onChange={(e) => setFormData(prev => ({ ...prev, catatan: e.target.value }))}
                                placeholder="Tuliskan catatan tajwid, makharijul huruf, atau ayat yang sempat terlupa..."
                                rows="2"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                            />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="px-5 py-3 rounded-2xl border border-slate-200 text-xs sm:text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
                            >
                                Batal
                            </button>

                            <button
                                type="submit"
                                disabled={submitting || !addFormValidation.isValid}
                                className="px-7 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl text-xs sm:text-sm font-black shadow-lg shadow-emerald-600/30 hover:shadow-emerald-600/40 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" /> Menyimpan...
                                    </>
                                ) : (
                                    <>
                                        <Save size={16} /> Simpan Setoran Hafalan
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* FILTER & SEARCH CONTROLS */}
            <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                    {/* Filter Staf (Only if Kabid) */}
                    {isKabid && (
                        <div className="relative min-w-[180px]">
                            <select
                                value={selectedStaffFilter}
                                onChange={(e) => setSelectedStaffFilter(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                            >
                                <option value="ALL">Semua Staf Sarpras</option>
                                <option value={user?.id}>Setoran Saya Sendiri</option>
                                {staffList.map(st => (
                                    <option key={st.id} value={st.id}>{st.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Filter Tipe: Semua / Ziyadah / Murajaah */}
                    <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
                        <button
                            onClick={() => setFilterTipe('ALL')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                filterTipe === 'ALL' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            Semua Tipe
                        </button>
                        <button
                            onClick={() => setFilterTipe('Ziyadah')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                filterTipe === 'Ziyadah' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-emerald-700'
                            }`}
                        >
                            <Sparkles size={12} /> Ziyadah
                        </button>
                        <button
                            onClick={() => setFilterTipe('Murajaah')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                filterTipe === 'Murajaah' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-blue-700'
                            }`}
                        >
                            <RotateCcw size={12} /> Murajaah
                        </button>
                    </div>

                    {/* Filter Juz */}
                    <div className="relative min-w-[130px]">
                        <select
                            value={filterJuz}
                            onChange={(e) => setFilterJuz(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                        >
                            <option value="ALL">Semua Juz</option>
                            {JUZ_LIST.map(j => (
                                <option key={j.number} value={j.number}>Juz {j.number}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Search Input */}
                <div className="relative min-w-[220px] sm:w-72">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Cari surah, penyimak, staf..."
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                    />
                    {searchQuery && (
                        <button 
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* RIWAYAT SETORAN TABLE & CARDS */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                            <BookOpen size={18} className="text-emerald-600" />
                            Riwayat Setoran Hafalan
                        </h3>
                        <p className="text-xs text-slate-400">
                            Daftar catatan ziyadah dan murajaah hafalan yang tersimpan
                        </p>
                    </div>
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                        {records.length} data ditemukan
                    </span>
                </div>

                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
                        <Loader2 size={32} className="animate-spin text-emerald-600" />
                        <span className="text-xs font-bold">Memuat riwayat setoran hafalan...</span>
                    </div>
                ) : records.length === 0 ? (
                    <div className="py-16 text-center space-y-3">
                        <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                            <BookOpen size={28} />
                        </div>
                        <h4 className="text-sm font-bold text-slate-700">Belum Ada Catatan Setoran</h4>
                        <p className="text-xs text-slate-400 max-w-sm mx-auto">
                            Klik tombol "Catat Setoran Baru" di atas untuk menambahkan hafalan pertama Anda.
                        </p>
                        <button
                            onClick={() => setShowForm(true)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 cursor-pointer"
                        >
                            <Plus size={16} /> Catat Sekarang
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Desktop Table View */}
                        <div className="hidden lg:block overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/80 text-[11px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-100">
                                        <th className="py-3.5 px-5">Tanggal</th>
                                        {isKabid && <th className="py-3.5 px-4">Staf</th>}
                                        <th className="py-3.5 px-4">Tipe Setoran</th>
                                        <th className="py-3.5 px-4">Surah & Juz</th>
                                        <th className="py-3.5 px-4">Rentang Ayat</th>
                                        <th className="py-3.5 px-4">Predikat</th>
                                        <th className="py-3.5 px-4">Penyimak / Catatan</th>
                                        <th className="py-3.5 px-5 text-right">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs">
                                    {records.map(rec => (
                                        <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                                            {/* Tanggal */}
                                            <td className="py-4 px-5 font-bold text-slate-800 whitespace-nowrap">
                                                {dayjs(rec.date).format('DD MMM YYYY')}
                                            </td>

                                            {/* Staf (if Kabid) */}
                                            {isKabid && (
                                                <td className="py-4 px-4 font-bold text-slate-900 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 font-black text-[11px] flex items-center justify-center shrink-0">
                                                            {(rec.user?.name || 'S').charAt(0).toUpperCase()}
                                                        </div>
                                                        <span className="truncate max-w-[130px]">{rec.user?.name || rec.user?.username || '-'}</span>
                                                    </div>
                                                </td>
                                            )}

                                            {/* Tipe Setoran */}
                                            <td className="py-4 px-4 whitespace-nowrap">
                                                {rec.tipeSetoran === 'Ziyadah' ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        <Sparkles size={12} /> Ziyadah
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                                        <RotateCcw size={12} /> Murajaah
                                                    </span>
                                                )}
                                            </td>

                                            {/* Surah & Juz */}
                                            <td className="py-4 px-4">
                                                <div className="font-black text-slate-800 flex items-center gap-2">
                                                    <span>{rec.surah}</span>
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                                        Juz {rec.juz}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Rentang Ayat */}
                                            <td className="py-4 px-4 whitespace-nowrap">
                                                <div className="font-bold text-slate-800">
                                                    Ayat {rec.ayatAwal} - {rec.ayatAkhir}
                                                </div>
                                                <div className="text-[10px] text-emerald-600 font-semibold">
                                                    ({rec.totalAyat} ayat)
                                                </div>
                                            </td>

                                            {/* Predikat */}
                                            <td className="py-4 px-4 whitespace-nowrap">
                                                <span className={`inline-block px-2.5 py-1 rounded-lg text-[11px] border ${getPredikatBadge(rec.nilai)}`}>
                                                    {rec.nilai}
                                                </span>
                                            </td>

                                            {/* Penyimak / Catatan */}
                                            <td className="py-4 px-4 max-w-xs">
                                                {rec.pembimbing && (
                                                    <p className="font-bold text-slate-700 text-[11px] flex items-center gap-1">
                                                        <User size={11} className="text-slate-400" />
                                                        {rec.pembimbing}
                                                    </p>
                                                )}
                                                {rec.catatan ? (
                                                    <p className="text-[11px] text-slate-500 italic truncate" title={rec.catatan}>
                                                        "{rec.catatan}"
                                                    </p>
                                                ) : !rec.pembimbing ? (
                                                    <span className="text-slate-400">-</span>
                                                ) : null}
                                            </td>

                                            {/* Aksi */}
                                            <td className="py-4 px-5 text-right whitespace-nowrap">
                                                <div className="inline-flex items-center gap-1.5">
                                                    {(isKabid || rec.userId === user?.id) && (
                                                        <>
                                                            <button
                                                                onClick={() => handleStartEdit(rec)}
                                                                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-blue-600 transition-all cursor-pointer"
                                                                title="Ubah Setoran"
                                                            >
                                                                <Edit2 size={15} />
                                                            </button>
                                                            <button
                                                                onClick={() => setDeletingRecord(rec)}
                                                                className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-500 hover:text-rose-600 transition-all cursor-pointer"
                                                                title="Hapus Setoran"
                                                            >
                                                                <Trash2 size={15} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Cards View */}
                        <div className="lg:hidden divide-y divide-slate-100">
                            {records.map(rec => (
                                <div key={rec.id} className="p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black text-slate-800">
                                                {dayjs(rec.date).format('DD MMMM YYYY')}
                                            </span>
                                            {rec.tipeSetoran === 'Ziyadah' ? (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    Ziyadah
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                                    Murajaah
                                                </span>
                                            )}
                                        </div>

                                        <span className={`px-2 py-0.5 rounded-lg text-[10px] border ${getPredikatBadge(rec.nilai)}`}>
                                            {rec.nilai}
                                        </span>
                                    </div>

                                    {isKabid && (
                                        <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                            <User size={13} className="text-slate-400" />
                                            <span>{rec.user?.name || rec.user?.username}</span>
                                        </div>
                                    )}

                                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center justify-between">
                                        <div>
                                            <h4 className="text-sm font-black text-slate-900">{rec.surah}</h4>
                                            <p className="text-xs font-bold text-emerald-700">
                                                Ayat {rec.ayatAwal} - {rec.ayatAkhir} <span className="text-slate-400 font-normal">({rec.totalAyat} ayat)</span>
                                            </p>
                                        </div>
                                        <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-sm">
                                            Juz {rec.juz}
                                        </span>
                                    </div>

                                    {(rec.pembimbing || rec.catatan) && (
                                        <div className="text-xs text-slate-500 space-y-0.5">
                                            {rec.pembimbing && <p className="font-semibold text-slate-600">Penyimak: {rec.pembimbing}</p>}
                                            {rec.catatan && <p className="italic">"{rec.catatan}"</p>}
                                        </div>
                                    )}

                                    {(isKabid || rec.userId === user?.id) && (
                                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-50">
                                            <button
                                                onClick={() => handleStartEdit(rec)}
                                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                                            >
                                                <Edit2 size={13} /> Ubah
                                            </button>
                                            <button
                                                onClick={() => setDeletingRecord(rec)}
                                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                                            >
                                                <Trash2 size={13} /> Hapus
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* EDIT MODAL */}
            {editingRecord && editFormData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-5 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center">
                                    <Edit2 size={18} />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-slate-800">Ubah Data Setoran</h3>
                                    <p className="text-xs text-slate-500">Sesuaikan informasi surah, ayat, atau catatan</p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setEditingRecord(null);
                                    setEditFormData(null);
                                }}
                                className="p-2 hover:bg-slate-200/60 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleUpdateSetoran} className="p-5 space-y-4 overflow-y-auto">
                            {/* Tipe Setoran Toggle */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-700">Tipe Setoran</label>
                                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                                    <button
                                        type="button"
                                        onClick={() => setEditFormData(prev => ({ ...prev, tipeSetoran: 'Ziyadah' }))}
                                        className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                            editFormData.tipeSetoran === 'Ziyadah' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600'
                                        }`}
                                    >
                                        Ziyadah (Baru)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEditFormData(prev => ({ ...prev, tipeSetoran: 'Murajaah' }))}
                                        className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                            editFormData.tipeSetoran === 'Murajaah' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600'
                                        }`}
                                    >
                                        Murajaah (Ulang)
                                    </button>
                                </div>
                            </div>

                            {/* Juz & Surah */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-700">Juz (1 - 30)</label>
                                    <select
                                        value={editFormData.juz}
                                        onChange={(e) => {
                                            const jNum = parseInt(e.target.value, 10);
                                            const surahs = getSurahsByJuz(jNum);
                                            const first = surahs[0] || QURAN_SURAHS[0];
                                            setEditFormData(prev => ({
                                                ...prev,
                                                juz: jNum,
                                                surahNumber: first.number,
                                                surah: first.name,
                                                ayatAwal: 1,
                                                ayatAkhir: first.totalVerses
                                            }));
                                        }}
                                        className="w-full mt-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 cursor-pointer"
                                    >
                                        {JUZ_LIST.map(j => (
                                            <option key={j.number} value={j.number}>Juz {j.number}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="relative" ref={editSurahDropdownRef}>
                                    <label className="text-xs font-bold text-slate-700">Surah</label>
                                    <button
                                        type="button"
                                        onClick={() => setIsEditSurahDropdownOpen(prev => !prev)}
                                        className="w-full mt-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 flex items-center justify-between cursor-pointer"
                                    >
                                        <span>{editFormData.surah}</span>
                                        <ChevronDown size={14} />
                                    </button>

                                    {isEditSurahDropdownOpen && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 z-30 overflow-hidden">
                                            <div className="p-2 border-b border-slate-100">
                                                <input
                                                    type="text"
                                                    value={editSurahSearchTerm}
                                                    onChange={(e) => setEditSurahSearchTerm(e.target.value)}
                                                    placeholder="Cari surah..."
                                                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                                                />
                                            </div>
                                            <div className="max-h-48 overflow-y-auto p-1 divide-y divide-slate-50">
                                                {availableSurahsInEditForm.map(s => (
                                                    <button
                                                        key={s.number}
                                                        type="button"
                                                        onClick={() => {
                                                            setEditFormData(prev => ({
                                                                ...prev,
                                                                surahNumber: s.number,
                                                                surah: s.name,
                                                                ayatAwal: 1,
                                                                ayatAkhir: s.totalVerses
                                                            }));
                                                            setIsEditSurahDropdownOpen(false);
                                                        }}
                                                        className="w-full p-2 text-left text-xs font-bold hover:bg-slate-50 flex items-center justify-between cursor-pointer"
                                                    >
                                                        <span>{s.number}. {s.name} ({s.totalVerses} ayat)</span>
                                                        <span className="font-arabic">{s.arabic}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Ayat Awal & Akhir */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-700">Dari Ayat</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={editFormData.ayatAwal}
                                        onChange={(e) => setEditFormData(prev => ({ ...prev, ayatAwal: parseInt(e.target.value, 10) || '' }))}
                                        className="w-full mt-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-700">Ke Ayat</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={editFormData.ayatAkhir}
                                        onChange={(e) => setEditFormData(prev => ({ ...prev, ayatAkhir: parseInt(e.target.value, 10) || '' }))}
                                        className="w-full mt-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Tanggal & Predikat */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-700">Tanggal</label>
                                    <input
                                        type="date"
                                        value={editFormData.tanggalSetoran}
                                        onChange={(e) => setEditFormData(prev => ({ ...prev, tanggalSetoran: e.target.value }))}
                                        className="w-full mt-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-700">Predikat</label>
                                    <select
                                        value={editFormData.nilai}
                                        onChange={(e) => setEditFormData(prev => ({ ...prev, nilai: e.target.value }))}
                                        className="w-full mt-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold cursor-pointer"
                                    >
                                        {PREDIKAT_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.value}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Pembimbing */}
                            <div>
                                <label className="text-xs font-bold text-slate-700">Penyimak / Ustadz</label>
                                <input
                                    type="text"
                                    value={editFormData.pembimbing}
                                    onChange={(e) => setEditFormData(prev => ({ ...prev, pembimbing: e.target.value }))}
                                    className="w-full mt-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                                />
                            </div>

                            {/* Catatan */}
                            <div>
                                <label className="text-xs font-bold text-slate-700">Catatan Tajwid</label>
                                <textarea
                                    value={editFormData.catatan}
                                    onChange={(e) => setEditFormData(prev => ({ ...prev, catatan: e.target.value }))}
                                    rows="2"
                                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingRecord(null);
                                        setEditFormData(null);
                                    }}
                                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting || !editFormValidation.isValid}
                                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20"
                                >
                                    {submitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                    Simpan Perubahan
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* DELETE CONFIRMATION MODAL */}
            {deletingRecord && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-4 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                            <Trash2 size={24} />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-base font-black text-slate-800">Hapus Setoran Hafalan?</h3>
                            <p className="text-xs text-slate-500">
                                Data setoran <span className="font-bold text-slate-700">{deletingRecord.surah} (Ayat {deletingRecord.ayatAwal}-{deletingRecord.ayatAkhir})</span> akan dihapus permanen.
                            </p>
                        </div>
                        <div className="flex items-center justify-center gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setDeletingRecord(null)}
                                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDelete}
                                disabled={submitting}
                                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md shadow-rose-500/20"
                            >
                                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                Ya, Hapus
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SetoranHafalanTab;
