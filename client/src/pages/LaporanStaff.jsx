import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    FileText, Calendar, Plus, Save, RefreshCw, Loader2, User, Camera, X, 
    Clock, CheckCircle, CheckCircle2, AlertTriangle, AlertCircle, Sparkles, 
    Search, Filter, Download, Printer, Award, TrendingUp, ChevronRight, 
    ChevronDown, MessageSquare, Send, CheckSquare, Eye, ShieldCheck, Tag,
    Warehouse, Box, Wrench, Truck, FileSignature, ArrowRight, Share2, Layers,
    Copy, Check, Trash2, Edit2, RotateCcw
} from 'lucide-react';
import { 
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
    CartesianGrid, PieChart, Pie, Cell, Legend 
} from 'recharts';
import * as XLSX from 'xlsx';
import api from '../lib/axios';
import { getMediaUrl } from '../lib/media';
import dayjs from 'dayjs';

const DIVISION_TAGS = [
    { key: 'ASET', label: 'Staff Manajemen Aset', icon: Box, color: 'bg-blue-500' },
    { key: 'GUDANG', label: 'Gudang & Logistik', icon: Warehouse, color: 'bg-amber-500' },
    { key: 'TEKNISI', label: 'Teknisi & Maintenance', icon: Wrench, color: 'bg-emerald-500' },
    { key: 'KENDARAAN', label: 'Armada Kendaraan', icon: Truck, color: 'bg-indigo-500' },
    { key: 'KEUANGAN', label: 'Staff Keuangan & Administrasi', icon: FileSignature, color: 'bg-violet-500' },
    { key: 'UMUM', label: 'Operasional Umum', icon: Layers, color: 'bg-slate-500' }
];

const ROUTINE_TEMPLATES = {
    ASET: [
        'Pengecekan fisik dan verifikasi kondisi aset ruangan/gedung sekolah & kantor yayasan',
        'Pencetakan, penempelan, dan pemindaian label barcode/QR Code pada aset inventaris baru',
        'Pembaruan Kartu Inventaris Ruangan (KIR) dan pencatatan mutasi/perpindahan aset antar unit',
        'Audit fisik berkala dan rekonsiliasi data inventaris sarana dan prasarana lingkungan yayasan',
        'Identifikasi aset rusak/rusak berat serta penyusunan usulan perbaikan atau penghapusan aset',
        'Pendataan, dokumentasi serah terima sarana baru, dan verifikasi fisik kelengkapan barang'
    ],
    GUDANG: [
        'Pengecekan dan rekonsiliasi stok seragam & ATK di rak penyimpanan',
        'Penerimaan dan inspeksi barang masuk dari vendor/supplier',
        'Penataan, labeling dus barang, dan pembersihan area gudang logistik',
        'Pemeriksaan dan pengemasan pesanan seragam untuk unit pemesan'
    ],
    TEKNISI: [
        'Inspeksi dan pembersihan filter unit AC di ruangan kantor/kelas',
        'Pengecekan panel kelistrikan, genset cadangan, dan lampu penerangan',
        'Pemeriksaan instalasi air, pompa distribusi, toren air, dan sanitasi',
        'Perbaikan ringan sarana meubeler, kunci pintu, dan fasilitas umum'
    ],
    KENDARAAN: [
        'Pemeriksaan harian armada (oli mesin, air radiator, minyak rem, aki)',
        'Pengecekan tekanan angin ban dan kebersihan interior & eksterior unit bus/mobil',
        'Verifikasi pengisian form checklist peminjaman kendaraan sebelum jalan',
        'Pencatatan kilometer akhir dan pengecekan BBM setelah pemakaian'
    ],
    KEUANGAN: [
        'Rekapitulasi kas kecil, nota pengeluaran operasional, dan bukti kas bon',
        'Verifikasi tagihan/invoice masuk dari vendor dan penyusunan berkas SPK',
        'Pencatatan laporan transaksi penjualan seragam dan rekap setoran bank',
        'Pengarsipan dokumen dinas, surat keluar, dan administrasi perkantoran'
    ],
    UMUM: [
        'Briefing koordinasi harian operasional staf sarana dan prasarana',
        'Pengecekan kesiapan sarana fasilitas untuk kegiatan yayasan/unit',
        'Monitoring kebersihan dan kerapian lingkungan kerja sarana'
    ]
};

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b'];

const LaporanStaff = () => {
    const { tab } = useParams();
    const navigate = useNavigate();

    // 1. Auth & Role State
    const user = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem('user')) || {};
        } catch (e) {
            return {};
        }
    }, []);

    const isKabid = useMemo(() => {
        const role = user.role || '';
        const pos = (user.position || '').toLowerCase();
        return role === 'KABID_SARPRAS' || pos.includes('kepala bidang sarana') || pos.includes('kabid sarpras');
    }, [user]);

    const userDivision = useMemo(() => {
        const pos = (user.position || '').toLowerCase();
        const role = (user.role || '').toLowerCase();
        if (pos.includes('keuangan dan administrasi') || (pos.includes('administrasi') && pos.includes('keuangan'))) return 'KEUANGAN';
        if (pos.includes('kendaraan') || pos.includes('driver') || pos.includes('supir') || pos.includes('transport') || pos.includes('armada')) return 'KENDARAAN';
        if (pos.includes('gudang') || pos.includes('logistik') || pos.includes('warehouse')) return 'GUDANG';
        if (pos.includes('teknisi') || pos.includes('maintenance') || pos.includes('listrik') || pos.includes('bangunan') || pos.includes('ac')) return 'TEKNISI';
        if (pos.includes('manajemen aset') || pos.includes('aset') || pos.includes('inventaris') || pos.includes('asset') || role.includes('aset')) return 'ASET';
        return 'UMUM';
    }, [user.position, user.role]);

    const [showAllTemplates, setShowAllTemplates] = useState(false);

    // Active Navigation Tab
    const [activeTab, setActiveTab] = useState(() => {
        if (tab) return tab;
        return isKabid ? 'dashboard' : 'laporan';
    });

    useEffect(() => {
        if (tab && tab !== activeTab) {
            setActiveTab(tab);
        }
    }, [tab]);

    // General States
    const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Staff Form States
    const [morningPoints, setMorningPoints] = useState([{ text: '', categoryTag: 'UMUM', status: 'COMPLETED', obstacleNote: '', photos: [] }]);
    const [afternoonPoints, setAfternoonPoints] = useState([{ text: '', categoryTag: 'UMUM', status: 'COMPLETED', obstacleNote: '', photos: [] }]);
    const [personalStats, setPersonalStats] = useState(null);
    const [activeRoutines, setActiveRoutines] = useState([]);
    const [uploadingPhotoIndex, setUploadingPhotoIndex] = useState(null);
    const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
    const [showTemplateAccordion, setShowTemplateAccordion] = useState(false);
    const [showMissedDates, setShowMissedDates] = useState(false);
    const [mobileSessionTab, setMobileSessionTab] = useState('ALL'); // 'ALL' | 'MORNING' | 'AFTERNOON'
    const [cameraModalConfig, setCameraModalConfig] = useState({ isOpen: false, index: null, period: 'morning' });

    // Staff Custom Templates (disusun sendiri oleh masing-masing staf)
    const customTemplatesKey = `staff_custom_templates_${user?.id || 'default'}`;
    const [staffCustomTemplates, setStaffCustomTemplates] = useState(() => {
        try {
            const saved = localStorage.getItem(customTemplatesKey);
            if (saved) return JSON.parse(saved);
        } catch (e) {
            console.error('Error loading custom templates:', e);
        }
        const initialList = ROUTINE_TEMPLATES[userDivision] || ROUTINE_TEMPLATES.ASET || [];
        return initialList.map((text, idx) => ({
            id: 'tpl_' + idx + '_' + Math.random().toString(36).substr(2, 6),
            text,
            categoryTag: userDivision || 'ASET'
        }));
    });

    const [newTemplateText, setNewTemplateText] = useState('');
    const [newTemplateCategory, setNewTemplateCategory] = useState(userDivision || 'ASET');
    const [isAddingTemplate, setIsAddingTemplate] = useState(false);
    const [editingTemplateId, setEditingTemplateId] = useState(null);
    const [editingTemplateText, setEditingTemplateText] = useState('');

    // Kabid Dashboard & Monitoring States
    const [dashboardData, setDashboardData] = useState(null);
    const [reportsFeed, setReportsFeed] = useState([]);
    const [filterCategory, setFilterCategory] = useState('ALL');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [verifyingReportId, setVerifyingReportId] = useState(null);
    const [verificationForm, setVerificationForm] = useState({ status: 'VERIFIED', feedbackNote: '' });

    // AI Analysis Modal & Date Range
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [aiAnalysisResult, setAiAnalysisResult] = useState('');
    const [loadingAi, setLoadingAi] = useState(false);
    const [aiAnalysisType, setAiAnalysisType] = useState('DAILY_DIGEST');
    const [aiStartDate, setAiStartDate] = useState(dayjs().startOf('week').add(1, 'day').format('YYYY-MM-DD'));
    const [aiEndDate, setAiEndDate] = useState(dayjs().format('YYYY-MM-DD'));
    const [aiRangePreset, setAiRangePreset] = useState('WEEK'); // 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM'
    const [aiAnalysisMeta, setAiAnalysisMeta] = useState(null);
    const [copiedAi, setCopiedAi] = useState(false);

    // Monthly Matrix States
    const [matrixSummary, setMatrixSummary] = useState([]);
    const [matrixDateRange, setMatrixDateRange] = useState([]);
    const [matrixMonth, setMatrixMonth] = useState(dayjs().format('YYYY-MM'));

    // Weekly PDF Summary Generator States
    const [weeklyData, setWeeklyData] = useState(null);
    const [weeklyStartDate, setWeeklyStartDate] = useState(dayjs().startOf('week').add(1, 'day').format('YYYY-MM-DD'));
    const [weeklyEndDate, setWeeklyEndDate] = useState(dayjs().startOf('week').add(6, 'day').format('YYYY-MM-DD'));
    const [customKabidNiy, setCustomKabidNiy] = useState('');

    // Assignments
    const [assignments, setAssignments] = useState([]);
    const [staffList, setStaffList] = useState([]);
    const [showAssignmentForm, setShowAssignmentForm] = useState(false);
    const [assignmentForm, setAssignmentForm] = useState({ title: '', description: '', assigneeId: '', dueDate: '', category: 'UMUM' });
    const [routinePurged, setRoutinePurged] = useState(() => localStorage.getItem('routine_tasks_purged') === 'true');

    // Lightbox modal for photos
    const [lightboxPhoto, setLightboxPhoto] = useState(null);

    // Initial Load
    useEffect(() => {
        if (activeTab === 'dashboard' && isKabid) {
            fetchDashboardAnalytics();
        } else if (activeTab === 'monitoring' && isKabid) {
            fetchReportsFeed();
        } else if (activeTab === 'laporan') {
            fetchMyReport();
            fetchMyStats();
            fetchAssignments();
        } else if (activeTab === 'matrix' && isKabid) {
            fetchMatrixData();
        } else if (activeTab === 'weekly-pdf' && isKabid) {
            fetchWeeklySummary();
        } else if (activeTab === 'penugasan') {
            fetchAssignments();
            if (isKabid) fetchStaffList();
        }
    }, [activeTab, selectedDate, matrixMonth, weeklyStartDate, weeklyEndDate]);

    // Auto-Save Draft to LocalStorage
    useEffect(() => {
        if (!isKabid && activeTab === 'laporan' && !loading) {
            const hasContent = morningPoints.some(p => p.text?.trim() || p.photos?.length > 0) || afternoonPoints.some(p => p.text?.trim() || p.photos?.length > 0);
            if (hasContent) {
                const draftKey = `draft_laporan_${user.id || 'default'}_${selectedDate}`;
                localStorage.setItem(draftKey, JSON.stringify({ morning: morningPoints, afternoon: afternoonPoints }));
            }
        }
    }, [morningPoints, afternoonPoints, selectedDate, activeTab, isKabid, loading, user.id]);

    // -------------------------------------------------------------
    // CLIENT-SIDE PHOTO COMPRESSION (HTML5 Canvas)
    // -------------------------------------------------------------
    const isCanvasDarkOrBlank = (canvas) => {
        try {
            const ctx = canvas.getContext('2d');
            const sampleW = Math.min(canvas.width, 40);
            const sampleH = Math.min(canvas.height, 40);
            const imgData = ctx.getImageData(0, 0, sampleW, sampleH).data;
            let total = 0;
            for (let i = 0; i < imgData.length; i += 4) {
                total += imgData[i] + imgData[i + 1] + imgData[i + 2];
            }
            const avg = total / (sampleW * sampleH * 3);
            return avg < 2; // threshold for completely pitch black frame
        } catch {
            return false;
        }
    };

    const compressImage = (fileOrBlobOrDataUrl, maxWidth = 1200, quality = 0.82) => {
        return new Promise((resolve, reject) => {
            let objectUrl = null;
            const img = new Image();

            img.onload = () => {
                if (objectUrl) URL.revokeObjectURL(objectUrl);
                try {
                    let width = img.naturalWidth || img.width;
                    let height = img.naturalHeight || img.height;

                    if (!width || !height) {
                        return reject(new Error('Dimensi foto tidak valid atau gagal dibaca.'));
                    }

                    // Respect both max width & max height for portrait / landscape
                    const maxHeight = 1600;
                    if (width > height) {
                        if (width > maxWidth) {
                            height = Math.round((height * maxWidth) / width);
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width = Math.round((width * maxHeight) / height);
                            height = maxHeight;
                        }
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    // Fill canvas with white base so transparent PNG/WebP doesn't turn black in JPEG conversion
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, width, height);

                    ctx.drawImage(img, 0, 0, width, height);

                    // Prevent black photo uploads
                    if (isCanvasDarkOrBlank(canvas)) {
                        return reject(new Error('Foto terdeteksi hitam kosong. Pastikan kamera tidak tertutup dan pencahayaan cukup.'));
                    }

                    // Add subtle timestamp watermark
                    const timestampStr = `${dayjs().format('DD/MM/YYYY HH:mm')} WIB - Bidang Sarana`;
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
                    ctx.fillRect(10, height - 35, ctx.measureText(timestampStr).width + 30, 25);
                    ctx.font = 'bold 12px sans-serif';
                    ctx.fillStyle = '#ffffff';
                    ctx.fillText(timestampStr, 20, height - 18);

                    const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                    resolve(compressedDataUrl);
                } catch (err) {
                    reject(err);
                }
            };

            img.onerror = () => {
                if (objectUrl) URL.revokeObjectURL(objectUrl);
                reject(new Error('Gagal memproses file foto. Pastikan format file adalah gambar valid (JPG/PNG).'));
            };

            if (typeof fileOrBlobOrDataUrl === 'string') {
                img.src = fileOrBlobOrDataUrl;
            } else if (fileOrBlobOrDataUrl instanceof Blob || fileOrBlobOrDataUrl instanceof File) {
                objectUrl = URL.createObjectURL(fileOrBlobOrDataUrl);
                img.src = objectUrl;
            } else {
                reject(new Error('Tipe data foto tidak dikenali.'));
            }
        });
    };

    // -------------------------------------------------------------
    // API CALLS: STAFF
    // -------------------------------------------------------------
    const fetchMyReport = async () => {
        try {
            setLoading(true);
            const res = await api.get('/laporan', {
                params: { date: selectedDate }
            });
            if (res.data.success) {
                const rep = res.data.myReport;
                const pts = rep?.metadata?.manualPoints;
                if (pts && (pts.morning?.length > 0 || pts.afternoon?.length > 0 || pts.morningPoints?.length > 0 || pts.afternoonPoints?.length > 0)) {
                    const m = pts.morning || pts.morningPoints || [];
                    const a = pts.afternoon || pts.afternoonPoints || [];
                    setMorningPoints(m.length > 0 ? m : [{ text: '', categoryTag: 'UMUM', status: 'COMPLETED', obstacleNote: '', photos: [] }]);
                    setAfternoonPoints(a.length > 0 ? a : [{ text: '', categoryTag: 'UMUM', status: 'COMPLETED', obstacleNote: '', photos: [] }]);
                    setHasRestoredDraft(false);
                } else {
                    // Try restore draft from LocalStorage
                    const draftKey = `draft_laporan_${user.id || 'default'}_${selectedDate}`;
                    const savedDraft = localStorage.getItem(draftKey);
                    if (savedDraft) {
                        try {
                            const parsed = JSON.parse(savedDraft);
                            if (parsed.morning?.length > 0 || parsed.afternoon?.length > 0) {
                                setMorningPoints(parsed.morning || [{ text: '', categoryTag: 'UMUM', status: 'COMPLETED', obstacleNote: '', photos: [] }]);
                                setAfternoonPoints(parsed.afternoon || [{ text: '', categoryTag: 'UMUM', status: 'COMPLETED', obstacleNote: '', photos: [] }]);
                                setHasRestoredDraft(true);
                                return;
                            }
                        } catch (e) {
                            console.error('Failed to parse draft', e);
                        }
                    }
                    setMorningPoints([{ text: '', categoryTag: 'UMUM', status: 'COMPLETED', obstacleNote: '', photos: [] }]);
                    setAfternoonPoints([{ text: '', categoryTag: 'UMUM', status: 'COMPLETED', obstacleNote: '', photos: [] }]);
                    setHasRestoredDraft(false);
                }
            }
        } catch (error) {
            console.error('Error fetching my report:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMyStats = async () => {
        try {
            const res = await api.get('/laporan/my-stats');
            if (res.data.success) {
                setPersonalStats(res.data.stats);
            }
        } catch (error) {
            console.error('Error fetching my stats:', error);
        }
    };

    const handleSaveReport = async () => {
        try {
            setSaving(true);
            const validMorning = morningPoints.filter(p => (p.text && p.text.trim()) || (p.photos && p.photos.length > 0));
            const validAfternoon = afternoonPoints.filter(p => (p.text && p.text.trim()) || (p.photos && p.photos.length > 0));

            const res = await api.post('/laporan/my', {
                targetDate: selectedDate,
                manualPoints: {
                    morning: validMorning,
                    afternoon: validAfternoon
                }
            });

            if (res.data.success) {
                // Clear draft
                const draftKey = `draft_laporan_${user.id || 'default'}_${selectedDate}`;
                localStorage.removeItem(draftKey);
                setHasRestoredDraft(false);

                alert('Laporan Harian berhasil disimpan!');
                fetchMyReport();
                fetchMyStats();
            }
        } catch (error) {
            console.error('Error saving report:', error);
            alert('Gagal menyimpan laporan.');
        } finally {
            setSaving(false);
        }
    };

    const handlePhotoUpload = async (index, fileOrDataUrl, period = 'morning') => {
        if (!fileOrDataUrl) return;
        try {
            setUploadingPhotoIndex(`${period}-${index}`);
            
            const compressedBase64 = await compressImage(fileOrDataUrl);

            // Upload directly to MinIO via backend
            const res = await api.post('/laporan/upload-photo', { base64: compressedBase64 });
            const photoUrl = res.data.url || compressedBase64;

            const photoObj = {
                url: photoUrl,
                timestamp: new Date().toISOString()
            };

            if (period === 'morning') {
                const newPts = [...morningPoints];
                if ((newPts[index].photos || []).length >= 5) return alert('Maksimal 5 foto per butir kegiatan!');
                newPts[index].photos = [...(newPts[index].photos || []), photoObj];
                setMorningPoints(newPts);
            } else {
                const newPts = [...afternoonPoints];
                if ((newPts[index].photos || []).length >= 5) return alert('Maksimal 5 foto per butir kegiatan!');
                newPts[index].photos = [...(newPts[index].photos || []), photoObj];
                setAfternoonPoints(newPts);
            }
        } catch (err) {
            console.error('Photo upload error:', err);
            alert(err.message || 'Gagal mengunggah foto.');
        } finally {
            setUploadingPhotoIndex(null);
        }
    };

    const handleRemovePhoto = (pointIndex, photoIndex, period = 'morning') => {
        if (period === 'morning') {
            const newPts = [...morningPoints];
            newPts[pointIndex].photos = newPts[pointIndex].photos.filter((_, i) => i !== photoIndex);
            setMorningPoints(newPts);
        } else {
            const newPts = [...afternoonPoints];
            newPts[pointIndex].photos = newPts[pointIndex].photos.filter((_, i) => i !== photoIndex);
            setAfternoonPoints(newPts);
        }
    };

    const applyRoutine = (routineText, categoryKey, period = 'morning') => {
        const item = {
            text: routineText,
            categoryTag: categoryKey,
            status: 'COMPLETED',
            obstacleNote: '',
            isRoutine: true,
            photos: []
        };
        if (period === 'morning') {
            setMorningPoints(prev => prev[0]?.text === '' && prev[0]?.photos?.length === 0 ? [item] : [...prev, item]);
        } else {
            setAfternoonPoints(prev => prev[0]?.text === '' && prev[0]?.photos?.length === 0 ? [item] : [...prev, item]);
        }
    };

    const convertTaskToReport = (task, period = 'morning') => {
        const item = {
            text: `[Tugas: ${task.title}] ${task.description}`,
            categoryTag: task.category || 'UMUM',
            status: task.progressPercentage === 100 ? 'COMPLETED' : 'IN_PROGRESS',
            obstacleNote: '',
            isRoutine: false,
            photos: []
        };
        if (period === 'morning') {
            setMorningPoints(prev => prev[0]?.text === '' && prev[0]?.photos?.length === 0 ? [item] : [...prev, item]);
        } else {
            setAfternoonPoints(prev => prev[0]?.text === '' && prev[0]?.photos?.length === 0 ? [item] : [...prev, item]);
        }
    };

    // Helper functions for staff custom template management
    const saveStaffTemplates = (templates) => {
        setStaffCustomTemplates(templates);
        try {
            localStorage.setItem(customTemplatesKey, JSON.stringify(templates));
        } catch (e) {
            console.error('Error saving templates to localStorage:', e);
        }
    };

    const handleAddCustomTemplate = (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!newTemplateText.trim()) return;
        const newTpl = {
            id: 'tpl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            text: newTemplateText.trim(),
            categoryTag: newTemplateCategory || userDivision || 'ASET'
        };
        const updated = [newTpl, ...staffCustomTemplates];
        saveStaffTemplates(updated);
        setNewTemplateText('');
        setIsAddingTemplate(false);
    };

    const handleDeleteCustomTemplate = (id) => {
        const updated = staffCustomTemplates.filter(t => t.id !== id);
        saveStaffTemplates(updated);
    };

    const handleSaveEditTemplate = (id) => {
        if (!editingTemplateText.trim()) return;
        const updated = staffCustomTemplates.map(t => t.id === id ? { ...t, text: editingTemplateText.trim() } : t);
        saveStaffTemplates(updated);
        setEditingTemplateId(null);
        setEditingTemplateText('');
    };

    const handleResetToDefaultTemplates = () => {
        if (!window.confirm('Kembalikan template ke saran awal divisi Anda? Perubahan template Anda saat ini akan direset.')) return;
        const initialList = ROUTINE_TEMPLATES[userDivision] || ROUTINE_TEMPLATES.ASET || [];
        const reset = initialList.map((text, idx) => ({
            id: 'tpl_' + idx + '_' + Math.random().toString(36).substr(2, 6),
            text,
            categoryTag: userDivision || 'ASET'
        }));
        saveStaffTemplates(reset);
    };

    // -------------------------------------------------------------
    // API CALLS: KABID (DASHBOARD, FEED, MATRIX, AI, VERIFY)
    // -------------------------------------------------------------
    const fetchDashboardAnalytics = async () => {
        try {
            setLoading(true);
            const res = await api.get('/laporan/dashboard/analytics', {
                params: { date: selectedDate }
            });
            if (res.data.success) {
                setDashboardData(res.data);
            }
        } catch (error) {
            console.error('Failed to fetch dashboard analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchReportsFeed = async () => {
        try {
            setLoading(true);
            const res = await api.get('/laporan', {
                params: {
                    date: selectedDate,
                    category: filterCategory,
                    status: filterStatus,
                    search: searchQuery
                }
            });
            if (res.data.success) {
                setReportsFeed(res.data.reports || []);
            }
        } catch (error) {
            console.error('Error fetching reports feed:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMatrixData = async () => {
        try {
            setLoading(true);
            const start = dayjs(matrixMonth).startOf('month').format('YYYY-MM-DD');
            const end = dayjs(matrixMonth).endOf('month').format('YYYY-MM-DD');
            const res = await api.get('/laporan/kabid/summary', {
                params: { startDate: start, endDate: end }
            });
            if (res.data.summary) {
                setMatrixSummary(res.data.summary);
                setMatrixDateRange(res.data.dateRange || []);
            }
        } catch (error) {
            console.error('Error fetching matrix summary:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchWeeklySummary = async () => {
        try {
            setLoading(true);
            const res = await api.get('/laporan/weekly-summary', {
                params: { startDate: weeklyStartDate, endDate: weeklyEndDate }
            });
            if (res.data.success) {
                setWeeklyData(res.data);
                if (res.data.kabid?.niy) {
                    setCustomKabidNiy(res.data.kabid.niy);
                } else if (user?.nip || user?.username) {
                    setCustomKabidNiy(user.nip || user.username);
                }
            }
        } catch (error) {
            console.error('Error fetching weekly summary:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyReport = async (reportId) => {
        try {
            const res = await api.put(`/laporan/${reportId}/verify`, verificationForm);
            if (res.data.success) {
                alert('Laporan berhasil diverifikasi!');
                setVerifyingReportId(null);
                fetchReportsFeed();
            }
        } catch (error) {
            console.error('Verification error:', error);
            alert('Gagal memverifikasi laporan.');
        }
    };

    const setAiPreset = (preset) => {
        setAiRangePreset(preset);
        const now = dayjs();
        if (preset === 'TODAY') {
            setAiStartDate(now.format('YYYY-MM-DD'));
            setAiEndDate(now.format('YYYY-MM-DD'));
        } else if (preset === 'WEEK') {
            setAiStartDate(now.startOf('week').add(1, 'day').format('YYYY-MM-DD'));
            setAiEndDate(now.format('YYYY-MM-DD'));
        } else if (preset === 'MONTH') {
            setAiStartDate(now.startOf('month').format('YYYY-MM-DD'));
            setAiEndDate(now.format('YYYY-MM-DD'));
        }
    };

    const runAiAnalysis = async (mode = 'DAILY_DIGEST', start = null, end = null) => {
        try {
            setLoadingAi(true);
            setAiAnalysisType(mode);
            setIsAiModalOpen(true);
            setAiAnalysisResult('');
            setCopiedAi(false);

            const sDate = start || aiStartDate;
            const eDate = end || aiEndDate;

            const res = await api.post('/laporan/ai/analyze', {
                startDate: sDate,
                endDate: eDate,
                mode
            });
            if (res.data.success) {
                setAiAnalysisResult(res.data.analysis);
                setAiAnalysisMeta({
                    period: res.data.period,
                    totalActivities: res.data.totalActivities,
                    totalObstacles: res.data.totalObstacles,
                    startDate: res.data.startDate,
                    endDate: res.data.endDate
                });
            }
        } catch (error) {
            console.error('AI Analysis failed:', error);
            setAiAnalysisResult(error.response?.data?.error || 'Gagal menjalankan analisis AI.');
        } finally {
            setLoadingAi(false);
        }
    };

    const handleExportExcelMatrix = () => {
        if (!matrixSummary || matrixSummary.length === 0) return;
        const data = matrixSummary.map(u => {
            const row = {
                'Nama Staf': u.name,
                'Jabatan': u.position
            };
            matrixDateRange.forEach(d => {
                row[dayjs(d).format('DD/MM')] = u.summaryByDate?.[d]?.status || 'BELUM';
            });
            return row;
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Matriks_Disiplin');
        XLSX.writeFile(wb, `Rekap_Disiplin_Sarpras_${matrixMonth}.xlsx`);
    };

    // Assignments
    const fetchAssignments = async () => {
        try {
            const res = await api.get('/personnel/assignments');
            if (res.data) {
                setAssignments(res.data.data || res.data.assignments || []);
            }
        } catch (err) {
            console.error('Error fetching assignments:', err);
        }
    };

    const fetchStaffList = async () => {
        try {
            const res = await api.get('/personnel/staff');
            if (res.data) {
                setStaffList(res.data.staff || res.data.users || []);
            }
        } catch (err) {
            console.error('Error fetching staff list:', err);
        }
    };

    const handleCreateAssignment = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);
            const res = await api.post('/personnel/assignments', {
                ...assignmentForm,
                assigneeId: parseInt(assignmentForm.assigneeId)
            });
            if (res.data.success || res.data.data) {
                alert('Penugasan berhasil dibuat!');
                setShowAssignmentForm(false);
                setAssignmentForm({ title: '', description: '', assigneeId: '', dueDate: '', category: 'UMUM' });
                fetchAssignments();
            }
        } catch (err) {
            alert('Gagal membuat penugasan.');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateTaskProgress = async (id, val) => {
        try {
            await api.put(`/personnel/assignments/${id}/status`, { progressPercentage: parseInt(val) });
            fetchAssignments();
        } catch (err) {
            alert('Gagal memperbarui progres.');
        }
    };

    const handlePurgeRoutine = async () => {
        if (!window.confirm('Bersihkan semua tugas rutin otomatis yang menumpuk di database? Tombol ini hanya bisa digunakan satu kali.')) return;
        try {
            setSaving(true);
            const res = await api.delete('/personnel/assignments/purge-routine');
            alert(res.data.message || 'Tugas rutin otomatis berhasil dibersihkan!');
            setRoutinePurged(true);
            localStorage.setItem('routine_tasks_purged', 'true');
            fetchAssignments();
        } catch (err) {
            alert('Gagal membersihkan tugas rutin.');
        } finally {
            setSaving(false);
        }
    };

    // Category chart data
    const categoryPieData = useMemo(() => {
        if (!dashboardData?.categoryCounts) return [];
        return Object.entries(dashboardData.categoryCounts)
            .filter(([_, val]) => val > 0)
            .map(([key, val]) => ({ name: key, value: val }));
    }, [dashboardData]);

    return (
        <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500 pb-36 sm:pb-16">
            {/* TOP HEADER */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 sm:gap-4 bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                        <FileText className="w-6 h-6 sm:w-7 sm:h-7" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            <h1 className="text-lg sm:text-2xl font-black text-slate-800 tracking-tight truncate">
                                {isKabid ? 'Manajemen & Kinerja Staf' : 'Laporan Harian Staf'}
                            </h1>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider ${isKabid ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {isKabid ? 'Kepala Bidang Sarana' : (user.position || 'Staff Manajemen Aset')}
                            </span>
                        </div>
                        <p className="text-slate-400 text-[11px] sm:text-sm font-medium mt-0.5 line-clamp-1 sm:line-clamp-none">
                            {isKabid 
                                ? 'Pusat evaluasi kerja, monitoring kendala lapangan, analitik AI, dan rekapitulasi pekanan.'
                                : 'Catat kegiatan kerja Sesi Pagi & Siang, dokumentasikan bukti foto, dan pantau tugas.'}
                        </p>
                    </div>
                </div>

                {/* Date Filter & Refresh with Mobile Presets */}
                <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    {['dashboard', 'monitoring', 'laporan'].includes(activeTab) && (
                        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 p-1 rounded-2xl shadow-2xs">
                            <button
                                type="button"
                                onClick={() => setSelectedDate(dayjs().format('YYYY-MM-DD'))}
                                className={`px-2.5 py-1 rounded-xl text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer ${
                                    selectedDate === dayjs().format('YYYY-MM-DD') ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200/60'
                                }`}
                            >
                                Hari Ini
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedDate(dayjs().subtract(1, 'day').format('YYYY-MM-DD'))}
                                className={`px-2.5 py-1 rounded-xl text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer ${
                                    selectedDate === dayjs().subtract(1, 'day').format('YYYY-MM-DD') ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200/60'
                                }`}
                            >
                                Kemarin
                            </button>
                            <div className="flex items-center gap-1 pl-1 pr-1.5 border-l border-slate-200">
                                <Calendar size={14} className="text-slate-400 shrink-0" />
                                <input 
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="bg-transparent border-none text-[11px] sm:text-xs font-bold text-slate-700 outline-none cursor-pointer w-24 sm:w-auto"
                                />
                            </div>
                        </div>
                    )}
                    <button
                        onClick={() => {
                            if (activeTab === 'dashboard') fetchDashboardAnalytics();
                            else if (activeTab === 'monitoring') fetchReportsFeed();
                            else if (activeTab === 'laporan') { fetchMyReport(); fetchMyStats(); }
                            else if (activeTab === 'matrix') fetchMatrixData();
                            else if (activeTab === 'weekly-pdf') fetchWeeklySummary();
                            else fetchAssignments();
                        }}
                        className="p-2 sm:p-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all cursor-pointer shrink-0"
                        title="Segarkan Data"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin text-blue-600' : ''} />
                    </button>
                </div>
            </div>

            {/* TAB NAVIGATION - Sticky & Scrollable */}
            <div className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-md -mx-4 px-4 sm:mx-0 sm:px-0 py-1 sm:py-2 flex items-center gap-1.5 sm:gap-2 overflow-x-auto custom-scrollbar border-b border-slate-200">
                {isKabid ? (
                    <>
                        <button
                            onClick={() => setActiveTab('dashboard')}
                            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                                activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                            }`}
                        >
                            <TrendingUp size={16} /> Executive Dashboard
                        </button>
                        <button
                            onClick={() => setActiveTab('monitoring')}
                            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                                activeTab === 'monitoring' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                            }`}
                        >
                            <Eye size={16} /> Monitoring Feed Tim
                        </button>
                        <button
                            onClick={() => setActiveTab('matrix')}
                            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                                activeTab === 'matrix' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                            }`}
                        >
                            <Calendar size={16} /> Matriks Kedisiplinan
                        </button>
                        <button
                            onClick={() => setActiveTab('weekly-pdf')}
                            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                                activeTab === 'weekly-pdf' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                            }`}
                        >
                            <Printer size={16} /> Laporan Mingguan Kabid (PDF)
                        </button>
                        <button
                            onClick={() => setActiveTab('penugasan')}
                            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                                activeTab === 'penugasan' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                            }`}
                        >
                            <CheckSquare size={16} /> Delegasi Penugasan
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            onClick={() => setActiveTab('laporan')}
                            className={`px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                                activeTab === 'laporan' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                            }`}
                        >
                            <FileText size={16} /> Laporan Harian Saya
                        </button>
                        <button
                            onClick={() => setActiveTab('penugasan')}
                            className={`px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                                activeTab === 'penugasan' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                            }`}
                        >
                            <CheckSquare size={16} /> Penugasan Saya
                        </button>
                    </>
                )}
            </div>

            {/* RESTORED DRAFT BANNER */}
            {hasRestoredDraft && activeTab === 'laporan' && (
                <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl text-xs text-amber-800 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold">
                        <Sparkles size={16} className="text-amber-600" />
                        Draft laporan sebelumnya berhasil dipulihkan otomatis dari browser Anda.
                    </div>
                    <button 
                        onClick={() => {
                            const draftKey = `draft_laporan_${user.id || 'default'}_${selectedDate}`;
                            localStorage.removeItem(draftKey);
                            setHasRestoredDraft(false);
                            fetchMyReport();
                        }} 
                        className="text-amber-700 underline font-bold hover:text-amber-900"
                    >
                        Hapus Draft
                    </button>
                </div>
            )}

            {/* TAB CONTENT */}
            {loading && !dashboardData && !reportsFeed.length && !morningPoints[0]?.text ? (
                <div className="h-72 flex flex-col items-center justify-center gap-3 bg-white rounded-3xl border border-slate-100 shadow-sm">
                    <Loader2 className="animate-spin text-blue-600" size={36} />
                    <span className="text-slate-400 text-sm font-bold">Memuat data kinerja...</span>
                </div>
            ) : (
                <>
                    {/* ============================================================== */}
                    {/* TAB: KABID DASHBOARD */}
                    {/* ============================================================== */}
                    {isKabid && activeTab === 'dashboard' && dashboardData && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            {/* KPI Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kepatuhan Hari Ini</p>
                                        <h3 className="text-2xl font-black text-slate-800 mt-1">{dashboardData.summary?.complianceRate}%</h3>
                                        <p className="text-xs text-emerald-600 font-bold mt-0.5">{dashboardData.summary?.lengkapCount} dari {dashboardData.summary?.totalStaff} staf lengkap</p>
                                    </div>
                                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                                        <CheckCircle2 size={24} />
                                    </div>
                                </div>

                                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Belum Lapor</p>
                                        <h3 className="text-2xl font-black text-rose-600 mt-1">{dashboardData.summary?.belumCount} Staf</h3>
                                        <p className="text-xs text-slate-400 font-medium mt-0.5">Parsial: {dashboardData.summary?.parsialCount} staf</p>
                                    </div>
                                    <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                                        <AlertCircle size={24} />
                                    </div>
                                </div>

                                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Butir Pekerjaan</p>
                                        <h3 className="text-2xl font-black text-slate-800 mt-1">{dashboardData.summary?.totalActivitiesToday}</h3>
                                        <p className="text-xs text-blue-600 font-bold mt-0.5">Tercatat hari ini</p>
                                    </div>
                                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                                        <FileText size={24} />
                                    </div>
                                </div>

                                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Foto Dokumentasi</p>
                                        <h3 className="text-2xl font-black text-slate-800 mt-1">{dashboardData.summary?.totalPhotosToday} Foto</h3>
                                        <p className="text-xs text-violet-600 font-bold mt-0.5">Tersimpan di MinIO</p>
                                    </div>
                                    <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
                                        <Camera size={24} />
                                    </div>
                                </div>
                            </div>

                            {/* AI BANNER & DATE RANGE ANALYSIS */}
                            <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 rounded-3xl shadow-xl space-y-4">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 text-amber-400 font-black text-xs uppercase tracking-widest">
                                            <Sparkles size={16} /> Analitik Cerdas AI (Google Gemini)
                                        </div>
                                        <h3 className="text-lg font-bold">Ringkasan Eksekutif & Evaluasi Kinerja Tim Berdasarkan Rentang Tanggal</h3>
                                        <p className="text-xs text-slate-300">Pilih rentang tanggal untuk menganalisis pencapaian staf, evaluasi beban kerja, atau solusi kendala.</p>
                                    </div>
                                </div>

                                {/* DATE RANGE SELECTOR & PRESETS */}
                                <div className="flex flex-wrap items-center gap-3 bg-white/10 p-3.5 rounded-2xl border border-white/10 backdrop-blur-xs">
                                    <div className="flex items-center gap-1 bg-black/20 p-1 rounded-xl">
                                        <button
                                            type="button"
                                            onClick={() => setAiPreset('TODAY')}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                                aiRangePreset === 'TODAY' ? 'bg-amber-500 text-slate-900 shadow-sm' : 'text-slate-300 hover:text-white'
                                            }`}
                                        >
                                            Hari Ini
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAiPreset('WEEK')}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                                aiRangePreset === 'WEEK' ? 'bg-amber-500 text-slate-900 shadow-sm' : 'text-slate-300 hover:text-white'
                                            }`}
                                        >
                                            Pekan Ini
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAiPreset('MONTH')}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                                aiRangePreset === 'MONTH' ? 'bg-amber-500 text-slate-900 shadow-sm' : 'text-slate-300 hover:text-white'
                                            }`}
                                        >
                                            Bulan Ini
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAiRangePreset('CUSTOM')}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                                aiRangePreset === 'CUSTOM' ? 'bg-amber-500 text-slate-900 shadow-sm' : 'text-slate-300 hover:text-white'
                                            }`}
                                        >
                                            Kustom
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-2 text-xs font-bold">
                                        <span className="text-slate-300">Dari:</span>
                                        <input 
                                            type="date"
                                            value={aiStartDate}
                                            onChange={(e) => {
                                                setAiStartDate(e.target.value);
                                                setAiRangePreset('CUSTOM');
                                            }}
                                            className="bg-black/30 border border-white/20 px-2.5 py-1.5 rounded-xl text-white text-xs outline-none cursor-pointer focus:border-amber-400"
                                        />
                                        <span className="text-slate-300">s.d.</span>
                                        <input 
                                            type="date"
                                            value={aiEndDate}
                                            onChange={(e) => {
                                                setAiEndDate(e.target.value);
                                                setAiRangePreset('CUSTOM');
                                            }}
                                            className="bg-black/30 border border-white/20 px-2.5 py-1.5 rounded-xl text-white text-xs outline-none cursor-pointer focus:border-amber-400"
                                        />
                                    </div>

                                    <div className="ml-auto flex flex-wrap items-center gap-2">
                                        <button
                                            onClick={() => runAiAnalysis('DAILY_DIGEST')}
                                            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer"
                                        >
                                            <Sparkles size={14} /> ✨ Ringkasan Eksekutif
                                        </button>
                                        <button
                                            onClick={() => runAiAnalysis('TEAM_PERFORMANCE')}
                                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-indigo-400/30 cursor-pointer"
                                        >
                                            <TrendingUp size={14} /> Evaluasi Tim
                                        </button>
                                        <button
                                            onClick={() => runAiAnalysis('OBSTACLE_SOLUTIONS')}
                                            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-white/20 cursor-pointer"
                                        >
                                            <Wrench size={14} /> Solusi Kendala
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* OBSTACLE ESCALATION HUB */}
                            {dashboardData.activeObstacles && dashboardData.activeObstacles.length > 0 && (
                                <div className="bg-rose-50 border border-rose-200 p-6 rounded-3xl space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold shrink-0">
                                                <AlertTriangle size={18} />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black text-rose-900 uppercase tracking-wider">Pusat Kendala Lapangan Hari Ini ({dashboardData.activeObstacles.length})</h3>
                                                <p className="text-xs text-rose-700">Pekerjaan staf yang membutuhkan perhatian khusus atau penugasan solusi dari Kabid.</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {dashboardData.activeObstacles.map((obs, oIdx) => (
                                            <div key={oIdx} className="bg-white p-4 rounded-2xl border border-rose-200 shadow-2xs space-y-2">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <span className="text-xs font-bold text-slate-800">{obs.staffName}</span>
                                                        <span className="text-[10px] text-slate-400 block font-medium">{obs.position}</span>
                                                    </div>
                                                    <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-rose-100 text-rose-700">
                                                        {obs.categoryTag}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-700 font-medium"><b>Pekerjaan:</b> {obs.activity}</p>
                                                <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-100 text-xs text-rose-800 font-bold">
                                                    ⚠️ Kendala: {obs.obstacleNote}
                                                </div>
                                                {obs.photos && obs.photos.length > 0 && (
                                                    <div className="flex gap-2 pt-1 overflow-x-auto">
                                                        {obs.photos.map((ph, pIdx) => (
                                                            <img 
                                                                key={pIdx} 
                                                                src={getMediaUrl(ph.url || ph)} 
                                                                alt="Bukti kendala" 
                                                                onClick={() => setLightboxPhoto(getMediaUrl(ph.url || ph))}
                                                                className="w-12 h-12 rounded-lg object-cover border border-rose-200 cursor-pointer hover:opacity-80 shrink-0" 
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 2-WORKING-DAYS INACTIVITY ALERT (MONDAY - FRIDAY) */}
                            {dashboardData.consecutiveMissingStaff && dashboardData.consecutiveMissingStaff.length > 0 && (
                                <div className="bg-amber-50 border border-amber-300 p-6 rounded-3xl space-y-4 shadow-sm">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-2xl bg-amber-600 text-white flex items-center justify-center font-bold shrink-0">
                                                <AlertCircle size={22} />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black text-amber-950 uppercase tracking-wider">
                                                    Peringatan Kedisiplinan: {dashboardData.consecutiveMissingStaff.length} Staf Tidak Lapor 2 Hari Kerja Berturut-turut
                                                </h3>
                                                <p className="text-xs text-amber-800 font-medium">
                                                    Staf berikut tidak mengisi laporan kegiatan pada 2 hari kerja (Senin - Jumat) terakhir.
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={async () => {
                                                try {
                                                    const res = await api.post('/laporan/notify-inactive');
                                                    alert(res.data.message || 'Peringatan berhasil dikirim ke WhatsApp Kabid!');
                                                } catch (e) {
                                                    alert('Gagal mengirim peringatan.');
                                                }
                                            }}
                                            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0 self-start sm:self-auto"
                                        >
                                            <Send size={14} /> Kirim Peringatan WhatsApp
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                                        {dashboardData.consecutiveMissingStaff.map((st, sIdx) => (
                                            <div key={sIdx} className="bg-white p-4 rounded-2xl border border-amber-200 space-y-1.5 shadow-2xs">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="text-xs font-bold text-slate-800">{st.name}</h4>
                                                    <span className="text-[9px] font-black uppercase text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                                                        2 Hari Kosong
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-slate-400 font-medium">{st.position}</p>
                                                <div className="text-[11px] text-rose-600 font-bold bg-rose-50 p-2 rounded-xl border border-rose-100">
                                                    ⚠️ {st.missedDays?.join(' & ')}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* CHARTS & LEADERBOARD GRID */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Chart 1: 7-Day Trend */}
                                <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Tren Kepatuhan 7 Hari Terakhir</h3>
                                            <p className="text-xs text-slate-400">Komparasi jumlah staf Lengkap, Parsial, dan Belum melapor.</p>
                                        </div>
                                    </div>
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={dashboardData.trend7Days || []}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                                <XAxis dataKey="date" tick={{ fontSize: 11, fontWeight: 'bold' }} stroke="#94a3b8" />
                                                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                                                <Legend wrapperStyle={{ fontSize: 12, fontWeight: 'bold', paddingTop: '10px' }} />
                                                <Bar dataKey="Lengkap" fill="#10b981" radius={[4, 4, 0, 0]} />
                                                <Bar dataKey="Parsial" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                                <Bar dataKey="Belum" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Chart 2: Division Breakdown Pie */}
                                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                                    <div>
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Distribusi Beban Kerja</h3>
                                        <p className="text-xs text-slate-400">Aktivitas per divisi hari ini.</p>
                                    </div>
                                    <div className="h-64 flex items-center justify-center">
                                        {categoryPieData.length === 0 ? (
                                            <span className="text-slate-400 text-xs italic">Belum ada aktivitas tercatat</span>
                                        ) : (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie data={categoryPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={4} dataKey="value">
                                                        {categoryPieData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                                                    <Legend wrapperStyle={{ fontSize: 10, fontWeight: 'bold' }} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* LEADERBOARD & REALTIME STAFF STATUS */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Leaderboard */}
                                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                            <Award size={18} className="text-amber-500" /> Leaderboard Kedisiplinan Staf (30 Hari)
                                        </h3>
                                    </div>
                                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                                        {dashboardData.leaderboard?.map((st, idx) => (
                                            <div key={st.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black ${idx === 0 ? 'bg-amber-400 text-slate-900' : idx === 1 ? 'bg-slate-300 text-slate-800' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-200 text-slate-600'}`}>
                                                        {idx + 1}
                                                    </div>
                                                    <div>
                                                        <h4 className="text-xs font-bold text-slate-800">{st.name}</h4>
                                                        <p className="text-[10px] text-slate-400">{st.position}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-xs font-black text-blue-600">{st.score}% Disiplin</span>
                                                    <span className="text-[10px] text-slate-400 block">{st.completeDays} hari lengkap</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Realtime Status List */}
                                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                        <User size={18} className="text-blue-600" /> Status Kehadiran Laporan Hari Ini
                                    </h3>
                                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                                        {dashboardData.staffStatusList?.map(st => (
                                            <div key={st.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                                <div>
                                                    <h4 className="text-xs font-bold text-slate-800">{st.name}</h4>
                                                    <p className="text-[10px] text-slate-400">{st.position}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase ${
                                                        st.status === 'LENGKAP' ? 'bg-emerald-100 text-emerald-700' :
                                                        st.status === 'PARSIAL' ? 'bg-amber-100 text-amber-700' :
                                                        'bg-rose-100 text-rose-700'
                                                    }`}>
                                                        {st.status === 'LENGKAP' ? 'Lengkap (Pagi & Siang)' : st.status === 'PARSIAL' ? 'Parsial (1 Sesi)' : 'Belum Lapor'}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ============================================================== */}
                    {/* TAB: MONITORING FEED TIM (KABID ONLY) */}
                    {/* ============================================================== */}
                    {isKabid && activeTab === 'monitoring' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            {/* Filter Bar */}
                            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                                    {/* Universal Search */}
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input 
                                            type="text"
                                            placeholder="Cari aktivitas, kata kunci kendala, atau nama staf..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && fetchReportsFeed()}
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    {/* Status Filter */}
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {['ALL', 'LENGKAP', 'PARSIAL', 'BELUM'].map(st => (
                                            <button
                                                key={st}
                                                onClick={() => { setFilterStatus(st); fetchReportsFeed(); }}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                                    filterStatus === st ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}
                                            >
                                                {st === 'ALL' ? 'Semua Status' : st}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Division Pills */}
                                <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
                                    <button
                                        onClick={() => { setFilterCategory('ALL'); fetchReportsFeed(); }}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                                            filterCategory === 'ALL' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        Semua Divisi
                                    </button>
                                    {DIVISION_TAGS.map(div => {
                                        const Icon = div.icon;
                                        return (
                                            <button
                                                key={div.key}
                                                onClick={() => { setFilterCategory(div.key); fetchReportsFeed(); }}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
                                                    filterCategory === div.key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}
                                            >
                                                <Icon size={14} /> {div.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* FEED LIST CARDS */}
                            {reportsFeed.length === 0 ? (
                                <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400 italic text-sm">
                                    Tidak ada laporan yang sesuai dengan filter tanggal atau kata kunci ini.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {reportsFeed.map(report => {
                                        const pts = report.metadata?.manualPoints;
                                        const morning = pts?.morning || pts?.morningPoints || [];
                                        const afternoon = pts?.afternoon || pts?.afternoonPoints || [];
                                        const verification = report.metadata?.verification;

                                        return (
                                            <div key={report.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between space-y-4">
                                                <div className="space-y-4">
                                                    {/* Header Card */}
                                                    <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                                                        <div>
                                                            <h3 className="text-base font-black text-slate-800">{report.user?.name}</h3>
                                                            <p className="text-xs text-slate-400 font-bold uppercase">{report.user?.position}</p>
                                                        </div>
                                                        <div className="flex flex-col items-end gap-1">
                                                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-black flex items-center gap-1">
                                                                <Clock size={10} /> Submit: {dayjs(report.metadata?.lastSubmittedAt || report.updatedAt).format('HH:mm')}
                                                            </span>
                                                            {verification && (
                                                                <span className={`text-[9px] px-2 py-0.5 rounded font-black uppercase ${
                                                                    verification.status === 'VERIFIED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                                                }`}>
                                                                    {verification.status === 'VERIFIED' ? 'Terverifikasi ✅' : 'Perlu Dilengkapi ⚠️'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Sesi Pagi */}
                                                    <div>
                                                        <h4 className="text-[11px] font-black text-blue-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                            <Clock size={12} /> Sesi Pagi (07.15 - 12.00)
                                                        </h4>
                                                        {morning.length === 0 ? (
                                                            <span className="text-xs text-slate-400 italic block pl-2">- Belum ada butir kegiatan -</span>
                                                        ) : (
                                                            <div className="space-y-3">
                                                                {morning.map((p, idx) => (
                                                                    <div key={idx} className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100 space-y-2">
                                                                        <div className="flex items-start gap-2">
                                                                            <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
                                                                            <div className="flex-1">
                                                                                <div className="flex items-center gap-2 mb-1">
                                                                                    <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[9px] font-black uppercase text-slate-600">
                                                                                        {p.categoryTag || 'UMUM'}
                                                                                    </span>
                                                                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                                                                        p.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                                                                                        p.status === 'OBSTACLE' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                                                                                    }`}>
                                                                                        {p.status === 'COMPLETED' ? 'Selesai 100%' : p.status === 'OBSTACLE' ? 'Kendala' : 'Dalam Proses'}
                                                                                    </span>
                                                                                </div>
                                                                                <p className="text-xs text-slate-700 font-medium leading-relaxed">{p.text}</p>
                                                                                {p.obstacleNote && (
                                                                                    <div className="mt-1.5 p-2 bg-rose-50 border border-rose-100 rounded-xl text-[11px] text-rose-800 font-bold">
                                                                                        ⚠️ Kendala: {p.obstacleNote}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                        {/* Photos */}
                                                                        {p.photos && p.photos.length > 0 && (
                                                                            <div className="flex gap-2 pt-1 overflow-x-auto pl-7">
                                                                                {p.photos.map((ph, pIdx) => (
                                                                                    <img 
                                                                                        key={pIdx} 
                                                                                        src={getMediaUrl(ph.url || ph)} 
                                                                                        alt="Bukti foto"
                                                                                        onClick={() => setLightboxPhoto(getMediaUrl(ph.url || ph))}
                                                                                        className="w-16 h-16 rounded-xl object-cover border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity shrink-0" 
                                                                                    />
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Sesi Siang */}
                                                    <div>
                                                        <h4 className="text-[11px] font-black text-indigo-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                            <Clock size={12} /> Sesi Siang (13.00 - 16.15)
                                                        </h4>
                                                        {afternoon.length === 0 ? (
                                                            <span className="text-xs text-slate-400 italic block pl-2">- Belum ada butir kegiatan -</span>
                                                        ) : (
                                                            <div className="space-y-3">
                                                                {afternoon.map((p, idx) => (
                                                                    <div key={idx} className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100 space-y-2">
                                                                        <div className="flex items-start gap-2">
                                                                            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
                                                                            <div className="flex-1">
                                                                                <div className="flex items-center gap-2 mb-1">
                                                                                    <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[9px] font-black uppercase text-slate-600">
                                                                                        {p.categoryTag || 'UMUM'}
                                                                                    </span>
                                                                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                                                                        p.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                                                                                        p.status === 'OBSTACLE' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                                                                                    }`}>
                                                                                        {p.status === 'COMPLETED' ? 'Selesai 100%' : p.status === 'OBSTACLE' ? 'Kendala' : 'Dalam Proses'}
                                                                                    </span>
                                                                                </div>
                                                                                <p className="text-xs text-slate-700 font-medium leading-relaxed">{p.text}</p>
                                                                                {p.obstacleNote && (
                                                                                    <div className="mt-1.5 p-2 bg-rose-50 border border-rose-100 rounded-xl text-[11px] text-rose-800 font-bold">
                                                                                        ⚠️ Kendala: {p.obstacleNote}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                        {/* Photos */}
                                                                        {p.photos && p.photos.length > 0 && (
                                                                            <div className="flex gap-2 pt-1 overflow-x-auto pl-7">
                                                                                {p.photos.map((ph, pIdx) => (
                                                                                    <img 
                                                                                        key={pIdx} 
                                                                                        src={getMediaUrl(ph.url || ph)} 
                                                                                        alt="Bukti foto"
                                                                                        onClick={() => setLightboxPhoto(getMediaUrl(ph.url || ph))}
                                                                                        className="w-16 h-16 rounded-xl object-cover border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity shrink-0" 
                                                                                    />
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Verification / Feedback Form for Kabid */}
                                                <div className="pt-4 border-t border-slate-100">
                                                    {verifyingReportId === report.id ? (
                                                        <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-100 space-y-3">
                                                            <div className="flex items-center justify-between">
                                                                <h4 className="text-xs font-black text-blue-900 uppercase">Verifikasi & Beri Arahan</h4>
                                                                <button onClick={() => setVerifyingReportId(null)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <button 
                                                                    type="button" 
                                                                    onClick={() => setVerificationForm({ ...verificationForm, status: 'VERIFIED' })}
                                                                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${verificationForm.status === 'VERIFIED' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}
                                                                >
                                                                    ✅ Terverifikasi Lengkap
                                                                </button>
                                                                <button 
                                                                    type="button" 
                                                                    onClick={() => setVerificationForm({ ...verificationForm, status: 'NEEDS_REVISION' })}
                                                                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${verificationForm.status === 'NEEDS_REVISION' ? 'bg-amber-500 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}
                                                                >
                                                                    ⚠️ Perlu Dilengkapi
                                                                </button>
                                                            </div>
                                                            <textarea 
                                                                rows="2" 
                                                                placeholder="Tuliskan catatan atau arahan pimpinan untuk staf..."
                                                                value={verificationForm.feedbackNote}
                                                                onChange={(e) => setVerificationForm({ ...verificationForm, feedbackNote: e.target.value })}
                                                                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500"
                                                            />
                                                            <button 
                                                                onClick={() => handleVerifyReport(report.id)}
                                                                className="w-full py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-1.5"
                                                            >
                                                                <Save size={14} /> Simpan Verifikasi & Feedback
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-between">
                                                            {verification?.feedbackNote ? (
                                                                <div className="text-xs text-slate-600 font-medium">
                                                                    <span className="font-bold text-blue-600">Arahan Kabid:</span> "{verification.feedbackNote}"
                                                                </div>
                                                            ) : (
                                                                <span className="text-[11px] text-slate-400 italic">Belum ada arahan</span>
                                                            )}
                                                            <button 
                                                                onClick={() => {
                                                                    setVerifyingReportId(report.id);
                                                                    setVerificationForm({
                                                                        status: verification?.status || 'VERIFIED',
                                                                        feedbackNote: verification?.feedbackNote || ''
                                                                    });
                                                                }}
                                                                className="px-3 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0"
                                                            >
                                                                <MessageSquare size={13} /> {verification ? 'Ubah Verifikasi' : 'Verifikasi / Beri Arahan'}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                        </div>
                    )}
                        </div>
                    )}

                    {/* ============================================================== */}
                    {/* TAB: LAPORAN HARIAN SAYA (STAFF ADMIN ASET) */}
                    {/* ============================================================== */}
                    {activeTab === 'laporan' && (
                        <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300">
                            {/* Personal Scorecard Banner - Compact on Mobile */}
                            {personalStats && (
                                <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 text-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
                                    <div className="space-y-1">
                                        <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-blue-200">Kartu Skor Kinerja Personal</span>
                                        <h3 className="text-base sm:text-lg font-black leading-tight">{user.name} ({user.position || 'Staff Manajemen Aset'})</h3>
                                        {personalStats.latestFeedback && (
                                            <div className="mt-1.5 bg-white/10 backdrop-blur-sm p-2 sm:p-2.5 rounded-xl text-xs text-white/90 border border-white/20">
                                                💬 <b>Catatan Kabid ({personalStats.latestFeedback.date}):</b> "{personalStats.latestFeedback.note}"
                                            </div>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 sm:flex items-center gap-2 sm:gap-6 shrink-0 bg-white/10 backdrop-blur-md p-2.5 sm:px-5 sm:py-3 rounded-2xl border border-white/20 text-center sm:text-left">
                                        <div>
                                            <span className="text-[9px] sm:text-[10px] font-bold text-blue-200 block">Kedisiplinan Bulan Ini</span>
                                            <span className="text-xl sm:text-2xl font-black text-white">{personalStats.disciplineScore}%</span>
                                        </div>
                                        <div className="border-l border-white/20 pl-3 sm:pl-6">
                                            <span className="text-[9px] sm:text-[10px] font-bold text-blue-200 block">Hari Lengkap</span>
                                            <span className="text-xl sm:text-2xl font-black text-white">{personalStats.completedDays} / {personalStats.totalWorkDaysPassed || 0} Hari</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* RANGKUMAN TANGGAL BELUM LAPOR (SENIN - JUMAT) */}
                            {personalStats?.missedDates && personalStats.missedDates.length > 0 ? (
                                <div className="bg-amber-50 border border-amber-300 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl space-y-2.5 sm:space-y-3 shadow-2xs">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
                                                <AlertCircle size={16} />
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="text-xs sm:text-sm font-black text-amber-950 uppercase tracking-wider truncate">
                                                    {personalStats.missedDates.length} Hari Belum Lengkap
                                                </h4>
                                                <p className="text-[10px] sm:text-[11px] text-amber-800 font-medium truncate sm:whitespace-normal">
                                                    Ketuk tanggal untuk mengisi susulan laporan harian.
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setShowMissedDates(!showMissedDates)}
                                            className="text-[10px] sm:text-[11px] font-bold text-amber-900 bg-amber-200/80 hover:bg-amber-200 px-2.5 py-1 rounded-xl transition-all shrink-0 cursor-pointer"
                                        >
                                            {showMissedDates ? 'Ciutkan' : 'Lihat Semua'}
                                        </button>
                                    </div>

                                    {/* Compact Horizontal Scroll on Mobile when Collapsed */}
                                    {!showMissedDates ? (
                                        <div className="flex gap-2 overflow-x-auto pb-1 pt-0.5 custom-scrollbar">
                                            {personalStats.missedDates.map((mItem, idx) => {
                                                const isSelected = selectedDate === mItem.date;
                                                return (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        onClick={() => setSelectedDate(mItem.date)}
                                                        className={`px-3 py-1.5 rounded-xl border text-left shrink-0 transition-all cursor-pointer ${
                                                            isSelected
                                                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                                                : 'bg-white hover:bg-amber-100/70 border-amber-200 text-slate-800'
                                                        }`}
                                                    >
                                                        <span className="text-[11px] font-black block leading-tight">{mItem.formattedDate}</span>
                                                        <span className={`text-[9px] font-bold block ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                                                            {mItem.hasMorning ? 'Pagi ✅' : 'Pagi ❌'} | {mItem.hasAfternoon ? 'Siang ✅' : 'Siang ❌'}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-1">
                                            {personalStats.missedDates.map((mItem, idx) => {
                                                const isSelected = selectedDate === mItem.date;
                                                return (
                                                    <div 
                                                        key={idx}
                                                        onClick={() => setSelectedDate(mItem.date)}
                                                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-2 group ${
                                                            isSelected
                                                                ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-400'
                                                                : 'bg-white hover:bg-amber-100/60 border-amber-200 text-slate-800 shadow-2xs'
                                                        }`}
                                                    >
                                                        <div className="flex items-start justify-between gap-1">
                                                            <div>
                                                                <span className="text-xs font-black block leading-tight">
                                                                    {mItem.formattedDate}
                                                                </span>
                                                                <span className={`text-[10px] font-medium ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                                                                    {mItem.isToday ? 'Hari Kerja Ini' : 'Hari Kerja'}
                                                                </span>
                                                            </div>
                                                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg shrink-0 ${
                                                                isSelected 
                                                                    ? 'bg-white text-blue-700' 
                                                                    : (mItem.status === 'BELUM' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800')
                                                            }`}>
                                                                {mItem.status === 'BELUM' ? 'Belum Diisi' : 'Parsial'}
                                                            </span>
                                                        </div>

                                                        <div className={`flex items-center justify-between text-[11px] pt-1.5 border-t ${
                                                            isSelected ? 'border-blue-500' : 'border-slate-100'
                                                        }`}>
                                                            <span className={`font-medium ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                                                                {mItem.hasMorning ? 'Pagi ✅' : 'Pagi ❌'} | {mItem.hasAfternoon ? 'Siang ✅' : 'Siang ❌'}
                                                            </span>
                                                            <span className={`font-bold flex items-center gap-1 ${
                                                                isSelected ? 'text-white underline' : 'text-blue-600 group-hover:text-blue-800'
                                                            }`}>
                                                                {isSelected ? 'Sedang Dipilih' : '✍️ Isi Laporan'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="bg-emerald-50 border border-emerald-200 p-3.5 sm:p-4 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-800 font-bold shadow-2xs">
                                    <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                                    <span>Alhamdulillah! Seluruh laporan hari kerja Anda (Senin s.d. Jumat) bulan ini telah terisi lengkap.</span>
                                </div>
                            )}

                            {/* ROUTINE CHECKLIST & TASK CONVERTER SECTION (Collapsible for Mobile Convenience) */}
                            <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm space-y-3">
                                <div 
                                    onClick={() => setShowTemplateAccordion(!showTemplateAccordion)}
                                    className="flex items-center justify-between cursor-pointer select-none"
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
                                            <CheckSquare size={18} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <h3 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider">
                                                    Template Rutinitas & Penugasan
                                                </h3>
                                                <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                                                    {DIVISION_TAGS.find(d => d.key === userDivision)?.label || userDivision}
                                                </span>
                                            </div>
                                            <p className="text-[10px] sm:text-xs text-slate-400 truncate">
                                                {showTemplateAccordion ? 'Klik untuk menutup daftar template' : 'Klik untuk menyalin kegiatan rutin otomatis ke sesi Pagi/Siang'}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="p-1.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all shrink-0 cursor-pointer"
                                    >
                                        <ChevronDown size={18} className={`transition-transform duration-200 ${showTemplateAccordion ? 'rotate-180' : ''}`} />
                                    </button>
                                </div>

                                {showTemplateAccordion && (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-3 border-t border-slate-100 animate-in fade-in duration-200">
                                        {/* Daily Routine Checklist - Personalized per staff */}
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between flex-wrap gap-2">
                                                <div>
                                                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                                        <span>Template Rutinitas Mandiri</span>
                                                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                                            {staffCustomTemplates.length} Kegiatan
                                                        </span>
                                                    </h4>
                                                    <p className="text-[10px] text-slate-400">Disusun oleh Anda sendiri sesuai tugas riil di lapangan</p>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsAddingTemplate(!isAddingTemplate)}
                                                        className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                                                            isAddingTemplate 
                                                                ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' 
                                                                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs'
                                                        }`}
                                                    >
                                                        {isAddingTemplate ? <X size={12} /> : <Plus size={12} />}
                                                        {isAddingTemplate ? 'Batal' : '+ Susun Template'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={handleResetToDefaultTemplates}
                                                        className="text-[10px] font-bold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 p-1.5 rounded-lg transition-all cursor-pointer"
                                                        title="Kembalikan ke saran awal divisi"
                                                    >
                                                        <RotateCcw size={12} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Inline Add Template Form */}
                                            {isAddingTemplate && (
                                                <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-2.5 animate-in fade-in duration-200">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider">Tambah Butir Kegiatan Rutin Baru</span>
                                                        <span className="text-[9px] text-emerald-600">Akan tersimpan di akun Anda</span>
                                                    </div>
                                                    <textarea
                                                        value={newTemplateText}
                                                        onChange={(e) => setNewTemplateText(e.target.value)}
                                                        placeholder="Tuliskan kegiatan rutin harian Anda di sini..."
                                                        rows={2}
                                                        className="w-full text-xs p-2.5 bg-white border border-emerald-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 resize-none"
                                                        autoFocus
                                                    />
                                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                                        <select
                                                            value={newTemplateCategory}
                                                            onChange={(e) => setNewTemplateCategory(e.target.value)}
                                                            className="text-xs py-1 px-2.5 bg-white border border-emerald-200 rounded-lg text-slate-700 font-semibold focus:outline-none"
                                                        >
                                                            <option value="ASET">Divisi Manajemen Aset</option>
                                                            <option value="GUDANG">Divisi Gudang & Logistik</option>
                                                            <option value="TEKNISI">Divisi Teknisi & Perbaikan</option>
                                                            <option value="KENDARAAN">Divisi Kendaraan</option>
                                                            <option value="KEUANGAN">Divisi Keuangan & Admin</option>
                                                            <option value="UMUM">Operasional Umum</option>
                                                        </select>
                                                        <button
                                                            type="button"
                                                            onClick={handleAddCustomTemplate}
                                                            disabled={!newTemplateText.trim()}
                                                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all cursor-pointer shadow-2xs"
                                                        >
                                                            Simpan Template
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Custom Template Items List */}
                                            <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                                                {staffCustomTemplates.length === 0 ? (
                                                    <div className="p-6 text-center text-slate-400 text-xs italic bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                                        Belum ada template kegiatan mandiri. Klik <strong>"+ Susun Template"</strong> untuk menambahkan rutinitas kerja Anda.
                                                    </div>
                                                ) : (
                                                    staffCustomTemplates.map((tpl, rIdx) => {
                                                        const isEditing = editingTemplateId === tpl.id;
                                                        return (
                                                            <div 
                                                                key={tpl.id || rIdx}
                                                                className="p-2.5 bg-white border border-slate-200/80 hover:border-slate-300 rounded-xl text-xs font-medium text-slate-700 space-y-2 shadow-2xs transition-all"
                                                            >
                                                                {isEditing ? (
                                                                    <div className="space-y-2">
                                                                        <textarea
                                                                            value={editingTemplateText}
                                                                            onChange={(e) => setEditingTemplateText(e.target.value)}
                                                                            rows={2}
                                                                            className="w-full text-xs p-2 bg-slate-50 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 resize-none"
                                                                            autoFocus
                                                                        />
                                                                        <div className="flex items-center justify-end gap-1.5">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setEditingTemplateId(null)}
                                                                                className="px-2.5 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-100 rounded-md transition-all cursor-pointer"
                                                                            >
                                                                                Batal
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleSaveEditTemplate(tpl.id)}
                                                                                className="px-2.5 py-1 text-[11px] font-bold bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-all cursor-pointer"
                                                                            >
                                                                                Simpan
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                                        <div className="flex items-start gap-1.5 flex-1 min-w-0">
                                                                            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${
                                                                                tpl.categoryTag === 'GUDANG' ? 'bg-amber-100 text-amber-800' :
                                                                                tpl.categoryTag === 'TEKNISI' ? 'bg-emerald-100 text-emerald-800' :
                                                                                tpl.categoryTag === 'KENDARAAN' ? 'bg-indigo-100 text-indigo-800' :
                                                                                tpl.categoryTag === 'KEUANGAN' ? 'bg-violet-100 text-violet-800' :
                                                                                tpl.categoryTag === 'ASET' ? 'bg-blue-100 text-blue-800' :
                                                                                'bg-slate-100 text-slate-700'
                                                                            }`}>
                                                                                {tpl.categoryTag || 'UMUM'}
                                                                            </span>
                                                                            <span className="text-slate-700 text-xs leading-relaxed break-words">{tpl.text}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => applyRoutine(tpl.text, tpl.categoryTag || 'UMUM', 'morning')}
                                                                                className="px-2 py-1 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 text-[10px] font-bold rounded-lg transition-all cursor-pointer active:scale-95"
                                                                                title="Tambahkan ke Sesi Pagi"
                                                                            >
                                                                                + Pagi
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => applyRoutine(tpl.text, tpl.categoryTag || 'UMUM', 'afternoon')}
                                                                                className="px-2 py-1 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 text-[10px] font-bold rounded-lg transition-all cursor-pointer active:scale-95"
                                                                                title="Tambahkan ke Sesi Siang"
                                                                            >
                                                                                + Siang
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => { setEditingTemplateId(tpl.id); setEditingTemplateText(tpl.text); }}
                                                                                className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all cursor-pointer"
                                                                                title="Edit butir template"
                                                                            >
                                                                                <Edit2 size={13} />
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleDeleteCustomTemplate(tpl.id)}
                                                                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all cursor-pointer"
                                                                                title="Hapus template"
                                                                            >
                                                                                <Trash2 size={13} />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>

                                            {/* Optional Reference Accordion from other divisions */}
                                            <div className="pt-1">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowAllTemplates(!showAllTemplates)}
                                                    className="text-[10px] font-bold text-slate-500 hover:text-blue-600 flex items-center gap-1 cursor-pointer transition-colors"
                                                >
                                                    <ChevronDown size={13} className={`transition-transform duration-200 ${showAllTemplates ? 'rotate-180' : ''}`} />
                                                    {showAllTemplates ? 'Sembunyikan Referensi Divisi Lain' : '💡 Butuh Ide? Lihat Referensi Template Divisi Lain'}
                                                </button>
                                                {showAllTemplates && (
                                                    <div className="mt-2 space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar p-2 bg-slate-50 rounded-xl border border-slate-200/60 animate-in fade-in duration-200">
                                                        {Object.entries(ROUTINE_TEMPLATES).map(([catKey, routines]) => (
                                                            <div key={catKey} className="space-y-1">
                                                                <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">
                                                                    {DIVISION_TAGS.find(d => d.key === catKey)?.label || catKey}
                                                                </span>
                                                                {routines.map((rText, rIdx) => (
                                                                    <div key={rIdx} className="p-1.5 bg-white rounded-lg border border-slate-200/60 text-[11px] flex items-center justify-between gap-1.5">
                                                                        <span className="flex-1 text-slate-600 truncate">{rText}</span>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                const newTpl = {
                                                                                    id: 'tpl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                                                                                    text: rText,
                                                                                    categoryTag: catKey
                                                                                };
                                                                                saveStaffTemplates([...staffCustomTemplates, newTpl]);
                                                                            }}
                                                                            className="text-[10px] font-bold text-emerald-600 hover:text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded cursor-pointer whitespace-nowrap"
                                                                            title="Salin butir ini ke Template Saya"
                                                                        >
                                                                            + Salin
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Active Assigned Tasks Converter */}
                                        <div className="space-y-2.5">
                                            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                                <Layers size={14} className="text-blue-600" /> Penugasan Khusus dari Pimpinan
                                            </h4>
                                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                                                {assignments.filter(t => t.assigneeId === user.id && t.progressPercentage < 100).length === 0 ? (
                                                    <div className="p-6 text-center text-slate-400 text-xs italic bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                                        Tidak ada penugasan khusus aktif yang tertunda untuk Anda.
                                                    </div>
                                                ) : (
                                                    assignments.filter(t => t.assigneeId === user.id && t.progressPercentage < 100).map(t => (
                                                        <div key={t.id} className="p-3 bg-slate-50 border border-slate-200/70 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
                                                            <div>
                                                                <h5 className="text-xs font-bold text-slate-800">{t.title}</h5>
                                                                <p className="text-[10px] text-slate-500 line-clamp-1">{t.description}</p>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => convertTaskToReport(t, 'morning')}
                                                                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold transition-all cursor-pointer active:scale-95"
                                                                >
                                                                    + Pagi
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => convertTaskToReport(t, 'afternoon')}
                                                                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold transition-all cursor-pointer active:scale-95"
                                                                >
                                                                    + Siang
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* MOBILE SESSION SWITCHER (Visible on Mobile Only) */}
                            <div className="flex sm:hidden items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setMobileSessionTab('ALL')}
                                    className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                        mobileSessionTab === 'ALL' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500'
                                    }`}
                                >
                                    Semua
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMobileSessionTab('MORNING')}
                                    className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                        mobileSessionTab === 'MORNING' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-500'
                                    }`}
                                >
                                    🌅 Pagi ({morningPoints.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMobileSessionTab('AFTERNOON')}
                                    className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                        mobileSessionTab === 'AFTERNOON' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500'
                                    }`}
                                >
                                    🌇 Siang ({afternoonPoints.length})
                                </button>
                            </div>

                            {/* SESI INPUT FORM: Sesi Pagi & Sesi Siang */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                                {/* Sesi Pagi */}
                                <div className={`bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm space-y-4 flex flex-col justify-between ${
                                    mobileSessionTab === 'AFTERNOON' ? 'hidden sm:flex' : 'flex'
                                }`}>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                            <div>
                                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                                    <Clock size={16} className="text-blue-600" /> Sesi Pagi (07.15 - 12.00 WIB)
                                                </h3>
                                                <p className="text-[11px] text-slate-400 font-medium">Batas pengingat: 13.30 WIB</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setMorningPoints([...morningPoints, { text: '', categoryTag: userDivision || 'UMUM', status: 'COMPLETED', obstacleNote: '', photos: [] }])}
                                                className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                                            >
                                                <Plus size={14} /> <span className="hidden sm:inline">Tambah Kegiatan</span><span className="sm:hidden">+ Butir</span>
                                            </button>
                                        </div>

                                        <div className="space-y-4">
                                            {morningPoints.map((point, index) => (
                                                <div key={`m-${index}`} className="p-3.5 sm:p-4 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-2.5">
                                                    {/* Row 1: Number + Division Dropdown + Delete */}
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                                            <span className="w-7 h-7 rounded-xl bg-blue-600 text-white text-xs font-black flex items-center justify-center shrink-0 shadow-xs">
                                                                {index + 1}
                                                            </span>
                                                            <select
                                                                value={point.categoryTag}
                                                                onChange={(e) => {
                                                                    const n = [...morningPoints];
                                                                    n[index].categoryTag = e.target.value;
                                                                    setMorningPoints(n);
                                                                }}
                                                                className="flex-1 min-w-0 px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none truncate"
                                                            >
                                                                {DIVISION_TAGS.map(d => (
                                                                    <option key={d.key} value={d.key}>{d.label}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        {morningPoints.length > 1 && (
                                                            <button 
                                                                type="button"
                                                                onClick={() => setMorningPoints(morningPoints.filter((_, i) => i !== index))}
                                                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer shrink-0"
                                                                title="Hapus butir ini"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Row 2: Touch-Friendly Status Pills (Fast on Mobile!) */}
                                                    <div className="flex items-center gap-1.5 pt-0.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const n = [...morningPoints];
                                                                n[index].status = 'COMPLETED';
                                                                setMorningPoints(n);
                                                            }}
                                                            className={`flex-1 py-1.5 px-2 rounded-xl text-[10px] sm:text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer border ${
                                                                point.status === 'COMPLETED' 
                                                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' 
                                                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                                            }`}
                                                        >
                                                            <CheckCircle2 size={12} /> Selesai 100%
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const n = [...morningPoints];
                                                                n[index].status = 'IN_PROGRESS';
                                                                setMorningPoints(n);
                                                            }}
                                                            className={`flex-1 py-1.5 px-2 rounded-xl text-[10px] sm:text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer border ${
                                                                point.status === 'IN_PROGRESS' 
                                                                    ? 'bg-amber-500 text-white border-amber-500 shadow-xs' 
                                                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                                            }`}
                                                        >
                                                            <Clock size={12} /> Proses
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const n = [...morningPoints];
                                                                n[index].status = 'OBSTACLE';
                                                                setMorningPoints(n);
                                                            }}
                                                            className={`flex-1 py-1.5 px-2 rounded-xl text-[10px] sm:text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer border ${
                                                                point.status === 'OBSTACLE' 
                                                                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs' 
                                                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                                            }`}
                                                        >
                                                            <AlertTriangle size={12} /> Kendala ⚠️
                                                        </button>
                                                    </div>

                                                    {/* Activity Description */}
                                                    <textarea
                                                        rows="3"
                                                        placeholder="Uraikan aktivitas kerja pagi yang dikerjakan secara jelas..."
                                                        value={point.text}
                                                        onChange={(e) => {
                                                            const n = [...morningPoints];
                                                            n[index].text = e.target.value;
                                                            setMorningPoints(n);
                                                        }}
                                                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
                                                    />

                                                    {/* Obstacle Note Field */}
                                                    {point.status === 'OBSTACLE' && (
                                                        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-1.5">
                                                            <AlertCircle size={14} className="text-rose-600 shrink-0" />
                                                            <input 
                                                                type="text"
                                                                placeholder="Jelaskan kendala/masalah yang dihadapi..."
                                                                value={point.obstacleNote}
                                                                onChange={(e) => {
                                                                    const n = [...morningPoints];
                                                                    n[index].obstacleNote = e.target.value;
                                                                    setMorningPoints(n);
                                                                }}
                                                                className="w-full bg-transparent text-xs font-bold text-rose-800 outline-none placeholder:text-rose-400"
                                                            />
                                                        </div>
                                                    )}

                                                    {/* Mobile-Friendly Photo Upload Zone (Opsional) */}
                                                    <div className="space-y-2 pt-1 border-t border-slate-200/60">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-1.5">
                                                                <Camera size={13} className="text-blue-600" />
                                                                <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                                                                    Foto Bukti Lapangan
                                                                </span>
                                                                <span className="text-[9px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md">
                                                                    (Opsional)
                                                                </span>
                                                            </div>
                                                            <span className="text-[10px] font-medium text-slate-400">
                                                                {(point.photos || []).length}/5 Foto
                                                            </span>
                                                        </div>

                                                        {/* Dual Upload Options: Direct Camera vs Gallery */}
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                disabled={uploadingPhotoIndex !== null}
                                                                onClick={() => setCameraModalConfig({ isOpen: true, index, period: 'morning' })}
                                                                className="flex-1 py-2 px-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl text-xs font-bold text-blue-700 flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-2xs cursor-pointer disabled:opacity-50"
                                                            >
                                                                {uploadingPhotoIndex === `morning-${index}` ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                                                                <span>{uploadingPhotoIndex === `morning-${index}` ? 'Mengunggah...' : 'Buka Kamera'}</span>
                                                            </button>

                                                            <label className="cursor-pointer py-2 px-3 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-2xs">
                                                                <Plus size={14} />
                                                                <span>Pilih Galeri</span>
                                                                <input 
                                                                    type="file" 
                                                                    accept="image/*" 
                                                                    className="hidden" 
                                                                    disabled={uploadingPhotoIndex !== null}
                                                                    onChange={(e) => {
                                                                        if (e.target.files[0]) {
                                                                            handlePhotoUpload(index, e.target.files[0], 'morning');
                                                                            e.target.value = '';
                                                                        }
                                                                    }} 
                                                                />
                                                            </label>
                                                        </div>

                                                        <p className="text-[10px] text-slate-400 italic">
                                                            * Upload foto bukti lapangan bersifat opsional (tidak wajib).
                                                        </p>

                                                        {/* Photo Thumbnails with Touch Delete Badge */}
                                                        {point.photos && point.photos.length > 0 && (
                                                            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 pt-1.5">
                                                                {point.photos.map((ph, pIdx) => (
                                                                    <div key={pIdx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 shadow-2xs bg-slate-100">
                                                                        <img 
                                                                            src={getMediaUrl(ph.url || ph)} 
                                                                            alt="Bukti Lapangan" 
                                                                            className="w-full h-full object-cover cursor-pointer"
                                                                            onClick={() => setLightboxPhoto(getMediaUrl(ph.url || ph))}
                                                                        />
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleRemovePhoto(index, pIdx, 'morning');
                                                                            }}
                                                                            className="absolute top-1 right-1 w-5 h-5 bg-rose-600 text-white rounded-full flex items-center justify-center shadow-md active:scale-90 transition-transform cursor-pointer"
                                                                            title="Hapus foto"
                                                                        >
                                                                            <X size={11} strokeWidth={3} />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}

                                            {/* Add Item Button at Bottom */}
                                            <button
                                                type="button"
                                                onClick={() => setMorningPoints([...morningPoints, { text: '', categoryTag: userDivision || 'UMUM', status: 'COMPLETED', obstacleNote: '', photos: [] }])}
                                                className="w-full py-2.5 bg-blue-50/80 hover:bg-blue-100 text-blue-700 border border-dashed border-blue-300 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                                            >
                                                <Plus size={15} /> Tambah Butir Kegiatan Pagi
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Sesi Siang */}
                                <div className={`bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm space-y-4 flex flex-col justify-between ${
                                    mobileSessionTab === 'MORNING' ? 'hidden sm:flex' : 'flex'
                                }`}>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                            <div>
                                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                                    <Clock size={16} className="text-indigo-600" /> Sesi Siang (13.00 - 16.15 WIB)
                                                </h3>
                                                <p className="text-[11px] text-slate-400 font-medium">Batas pengingat: 16.16 WIB</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setAfternoonPoints([...afternoonPoints, { text: '', categoryTag: userDivision || 'UMUM', status: 'COMPLETED', obstacleNote: '', photos: [] }])}
                                                className="px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                                            >
                                                <Plus size={14} /> <span className="hidden sm:inline">Tambah Kegiatan</span><span className="sm:hidden">+ Butir</span>
                                            </button>
                                        </div>

                                        <div className="space-y-4">
                                            {afternoonPoints.map((point, index) => (
                                                <div key={`a-${index}`} className="p-3.5 sm:p-4 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-2.5">
                                                    {/* Row 1: Number + Division Dropdown + Delete */}
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                                            <span className="w-7 h-7 rounded-xl bg-indigo-600 text-white text-xs font-black flex items-center justify-center shrink-0 shadow-xs">
                                                                {index + 1}
                                                            </span>
                                                            <select
                                                                value={point.categoryTag}
                                                                onChange={(e) => {
                                                                    const n = [...afternoonPoints];
                                                                    n[index].categoryTag = e.target.value;
                                                                    setAfternoonPoints(n);
                                                                }}
                                                                className="flex-1 min-w-0 px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none truncate"
                                                            >
                                                                {DIVISION_TAGS.map(d => (
                                                                    <option key={d.key} value={d.key}>{d.label}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        {afternoonPoints.length > 1 && (
                                                            <button 
                                                                type="button"
                                                                onClick={() => setAfternoonPoints(afternoonPoints.filter((_, i) => i !== index))}
                                                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer shrink-0"
                                                                title="Hapus butir ini"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Row 2: Touch-Friendly Status Pills */}
                                                    <div className="flex items-center gap-1.5 pt-0.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const n = [...afternoonPoints];
                                                                n[index].status = 'COMPLETED';
                                                                setAfternoonPoints(n);
                                                            }}
                                                            className={`flex-1 py-1.5 px-2 rounded-xl text-[10px] sm:text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer border ${
                                                                point.status === 'COMPLETED' 
                                                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' 
                                                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                                            }`}
                                                        >
                                                            <CheckCircle2 size={12} /> Selesai 100%
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const n = [...afternoonPoints];
                                                                n[index].status = 'IN_PROGRESS';
                                                                setAfternoonPoints(n);
                                                            }}
                                                            className={`flex-1 py-1.5 px-2 rounded-xl text-[10px] sm:text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer border ${
                                                                point.status === 'IN_PROGRESS' 
                                                                    ? 'bg-amber-500 text-white border-amber-500 shadow-xs' 
                                                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                                            }`}
                                                        >
                                                            <Clock size={12} /> Proses
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const n = [...afternoonPoints];
                                                                n[index].status = 'OBSTACLE';
                                                                setAfternoonPoints(n);
                                                            }}
                                                            className={`flex-1 py-1.5 px-2 rounded-xl text-[10px] sm:text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer border ${
                                                                point.status === 'OBSTACLE' 
                                                                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs' 
                                                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                                            }`}
                                                        >
                                                            <AlertTriangle size={12} /> Kendala ⚠️
                                                        </button>
                                                    </div>

                                                    {/* Activity Description */}
                                                    <textarea
                                                        rows="3"
                                                        placeholder="Uraikan aktivitas kerja siang yang dikerjakan secara jelas..."
                                                        value={point.text}
                                                        onChange={(e) => {
                                                            const n = [...afternoonPoints];
                                                            n[index].text = e.target.value;
                                                            setAfternoonPoints(n);
                                                        }}
                                                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                                                    />

                                                    {/* Obstacle Note Field */}
                                                    {point.status === 'OBSTACLE' && (
                                                        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-1.5">
                                                            <AlertCircle size={14} className="text-rose-600 shrink-0" />
                                                            <input 
                                                                type="text"
                                                                placeholder="Jelaskan kendala/masalah yang dihadapi..."
                                                                value={point.obstacleNote}
                                                                onChange={(e) => {
                                                                    const n = [...afternoonPoints];
                                                                    n[index].obstacleNote = e.target.value;
                                                                    setAfternoonPoints(n);
                                                                }}
                                                                className="w-full bg-transparent text-xs font-bold text-rose-800 outline-none placeholder:text-rose-400"
                                                            />
                                                        </div>
                                                    )}

                                                    {/* Mobile-Friendly Photo Upload Zone (Opsional) */}
                                                    <div className="space-y-2 pt-1 border-t border-slate-200/60">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-1.5">
                                                                <Camera size={13} className="text-indigo-600" />
                                                                <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                                                                    Foto Bukti Lapangan
                                                                </span>
                                                                <span className="text-[9px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md">
                                                                    (Opsional)
                                                                </span>
                                                            </div>
                                                            <span className="text-[10px] font-medium text-slate-400">
                                                                {(point.photos || []).length}/5 Foto
                                                            </span>
                                                        </div>

                                                        {/* Dual Upload Options: Direct Camera vs Gallery */}
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                disabled={uploadingPhotoIndex !== null}
                                                                onClick={() => setCameraModalConfig({ isOpen: true, index, period: 'afternoon' })}
                                                                className="flex-1 py-2 px-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-700 flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-2xs cursor-pointer disabled:opacity-50"
                                                            >
                                                                {uploadingPhotoIndex === `afternoon-${index}` ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                                                                <span>{uploadingPhotoIndex === `afternoon-${index}` ? 'Mengunggah...' : 'Buka Kamera'}</span>
                                                            </button>

                                                            <label className="cursor-pointer py-2 px-3 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-2xs">
                                                                <Plus size={14} />
                                                                <span>Galeri</span>
                                                                <input 
                                                                    type="file" 
                                                                    accept="image/*" 
                                                                    className="hidden" 
                                                                    disabled={uploadingPhotoIndex !== null}
                                                                    onChange={(e) => {
                                                                        if (e.target.files[0]) {
                                                                            handlePhotoUpload(index, e.target.files[0], 'afternoon');
                                                                            e.target.value = '';
                                                                        }
                                                                    }} 
                                                                />
                                                            </label>
                                                        </div>

                                                        <p className="text-[10px] text-slate-400 italic">
                                                            * Upload foto bukti lapangan bersifat opsional (tidak wajib).
                                                        </p>

                                                        {/* Photo Thumbnails with Touch Delete Badge */}
                                                        {point.photos && point.photos.length > 0 && (
                                                            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 pt-1.5">
                                                                {point.photos.map((ph, pIdx) => (
                                                                    <div key={pIdx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 shadow-2xs bg-slate-100">
                                                                        <img 
                                                                            src={getMediaUrl(ph.url || ph)} 
                                                                            alt="Bukti Lapangan" 
                                                                            className="w-full h-full object-cover cursor-pointer"
                                                                            onClick={() => setLightboxPhoto(getMediaUrl(ph.url || ph))}
                                                                        />
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleRemovePhoto(index, pIdx, 'afternoon');
                                                                            }}
                                                                            className="absolute top-1 right-1 w-5 h-5 bg-rose-600 text-white rounded-full flex items-center justify-center shadow-md active:scale-90 transition-transform cursor-pointer"
                                                                            title="Hapus foto"
                                                                        >
                                                                            <X size={11} strokeWidth={3} />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}

                                            {/* Add Item Button at Bottom */}
                                            <button
                                                type="button"
                                                onClick={() => setAfternoonPoints([...afternoonPoints, { text: '', categoryTag: userDivision || 'UMUM', status: 'COMPLETED', obstacleNote: '', photos: [] }])}
                                                className="w-full py-2.5 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 border border-dashed border-indigo-300 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                                            >
                                                <Plus size={15} /> Tambah Butir Kegiatan Siang
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* SAVE BUTTON - Floating on Mobile above Navbar, Sticky on Desktop */}
                            <div className="fixed sm:sticky bottom-18 sm:bottom-4 z-30 left-3 right-3 sm:left-auto sm:right-auto sm:flex sm:justify-end">
                                <button
                                    type="button"
                                    onClick={handleSaveReport}
                                    disabled={saving}
                                    className="w-full sm:w-auto px-6 sm:px-8 py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 text-white font-black text-sm rounded-2xl shadow-xl shadow-blue-500/30 hover:from-blue-700 hover:to-indigo-800 transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 active:scale-95"
                                >
                                    {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                    <span>Simpan Laporan Harian</span>
                                    <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full">
                                        {dayjs(selectedDate).format('DD/MM')}
                                    </span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ============================================================== */}
                    {/* TAB: MATRIKS KEDISIPLINAN BULANAN (KABID ONLY) */}
                    {/* ============================================================== */}
                    {isKabid && activeTab === 'matrix' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h3 className="text-base font-black text-slate-800">Matriks Rekapitulasi Kedisiplinan Staf</h3>
                                    <p className="text-xs text-slate-400 font-medium">Status kehadiran laporan harian seluruh staf dalam satu bulan berjalan.</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <input 
                                        type="month" 
                                        value={matrixMonth}
                                        onChange={(e) => setMatrixMonth(e.target.value)}
                                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
                                    />
                                    <button
                                        onClick={handleExportExcelMatrix}
                                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                                    >
                                        <Download size={14} /> Ekspor Excel
                                    </button>
                                </div>
                            </div>

                            {/* Table */}
                            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                                <div className="overflow-x-auto custom-scrollbar">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase border-b border-slate-100">
                                                <th className="p-4 sticky left-0 bg-slate-50 z-10">Nama Staf</th>
                                                <th className="p-4">Jabatan</th>
                                                {matrixDateRange.map(d => (
                                                    <th key={d} className="p-2 text-center min-w-[36px]">{dayjs(d).format('DD')}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-medium">
                                            {matrixSummary.map(st => (
                                                <tr key={st.id} className="hover:bg-slate-50/60 transition-colors">
                                                    <td className="p-4 font-bold text-slate-800 sticky left-0 bg-white z-10">{st.name}</td>
                                                    <td className="p-4 text-slate-500">{st.position}</td>
                                                    {matrixDateRange.map(d => {
                                                        const stat = st.summaryByDate?.[d]?.status || 'BELUM';
                                                        return (
                                                            <td key={d} className="p-1 text-center">
                                                                <span className={`inline-block w-6 h-6 rounded-lg text-[10px] font-bold leading-6 ${
                                                                    stat === 'LENGKAP' ? 'bg-emerald-100 text-emerald-700' :
                                                                    stat === 'PARSIAL' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-300'
                                                                }`} title={`${st.name} (${d}): ${stat}`}>
                                                                    {stat === 'LENGKAP' ? '✓' : stat === 'PARSIAL' ? '½' : '—'}
                                                                </span>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ============================================================== */}
                    {/* TAB: LAPORAN MINGGUAN KABID (PDF EXPORT) */}
                    {/* ============================================================== */}
                    {isKabid && activeTab === 'weekly-pdf' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            {/* Control Bar */}
                            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
                                <div>
                                    <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                                        <Printer className="text-indigo-600" size={20} /> Generator Laporan Mingguan Kepala Bidang Sarana
                                    </h3>
                                    <p className="text-xs text-slate-400 font-medium">Format resmi siap cetak / simpan PDF untuk laporan ke Pimpinan Yayasan.</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
                                        <span>Dari:</span>
                                        <input type="date" value={weeklyStartDate} onChange={(e) => setWeeklyStartDate(e.target.value)} className="bg-transparent outline-none" />
                                        <span>Sampai:</span>
                                        <input type="date" value={weeklyEndDate} onChange={(e) => setWeeklyEndDate(e.target.value)} className="bg-transparent outline-none" />
                                    </div>
                                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
                                        <span>NIY:</span>
                                        <input 
                                            type="text" 
                                            value={customKabidNiy} 
                                            onChange={(e) => setCustomKabidNiy(e.target.value)} 
                                            placeholder="NIY Kepala..." 
                                            className="w-28 bg-white px-2 py-0.5 rounded border border-slate-200 font-mono text-xs outline-none" 
                                            title="Nomor Induk Yayasan (NIY) Kepala Bidang Sarana"
                                        />
                                    </div>
                                    <button
                                        onClick={() => window.print()}
                                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20 cursor-pointer"
                                    >
                                        <Printer size={16} /> Cetak / Unduh PDF
                                    </button>
                                </div>
                            </div>

                            {/* PRINTABLE DOCUMENT CONTAINER */}
                            <div className="bg-white p-8 md:p-12 rounded-3xl border border-slate-200 shadow-sm space-y-8 max-w-4xl mx-auto text-slate-800 print:border-none print:shadow-none print:p-0">
                                {/* KOP SURAT YAYASAN */}
                                <div className="text-center border-b-2 border-slate-800 pb-4 space-y-1">
                                    <h2 className="text-xl font-black tracking-wider text-slate-900 uppercase">YAYASAN DAR EL-IMAN PADANG</h2>
                                    <h3 className="text-base font-black text-indigo-950 uppercase tracking-widest">BIDANG SARANA</h3>
                                    <p className="text-[11px] text-slate-600">Jl. Gunuang Juaro, Surau Gadang, Kec. Nanggalo, Kota Padang, Sumatera Barat</p>
                                </div>

                                {/* TITLE */}
                                <div className="text-center space-y-1">
                                    <h4 className="text-sm font-black uppercase tracking-wider underline">LAPORAN KINERJA & AKTIVITAS MINGGUAN</h4>
                                    <p className="text-xs font-bold text-slate-600">Periode: {weeklyData?.period?.formattedPeriod}</p>
                                </div>

                                {/* I. EXECUTIVE SUMMARY */}
                                <div className="space-y-2">
                                    <h5 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">I. Ringkasan Eksekutif Kinerja</h5>
                                    <div className="grid grid-cols-3 gap-3 text-center pt-2">
                                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                                            <span className="text-[10px] font-bold text-slate-500 block uppercase">Pekerjaan Selesai</span>
                                            <span className="text-xl font-black text-emerald-700">{weeklyData?.stats?.totalCompleted || 0}</span>
                                        </div>
                                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                                            <span className="text-[10px] font-bold text-slate-500 block uppercase">Dalam Proses</span>
                                            <span className="text-xl font-black text-amber-700">{weeklyData?.stats?.totalInProgress || 0}</span>
                                        </div>
                                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                                            <span className="text-[10px] font-bold text-slate-500 block uppercase">Kendala Ditangani</span>
                                            <span className="text-xl font-black text-rose-700">{weeklyData?.stats?.totalObstacles || 0}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* II. RINCIAN AKTIVITAS PER HARI */}
                                <div className="space-y-4">
                                    <h5 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">II. Rincian Aktivitas Harian Staf Bidang Sarana</h5>
                                    {weeklyData?.dailyDivisionBreakdown?.map((dayObj, dIdx) => (
                                        <div key={dIdx} className="space-y-2">
                                            <h6 className="text-xs font-bold text-indigo-900 bg-slate-100 px-3 py-1.5 rounded-lg">{dayObj.date} ({dayObj.totalActivities} kegiatan)</h6>
                                            {dayObj.activities.length === 0 ? (
                                                <p className="text-[11px] text-slate-400 italic pl-3">- Tidak ada aktivitas tercatat -</p>
                                            ) : (
                                                <ul className="list-disc pl-6 space-y-1 text-xs leading-relaxed">
                                                    {dayObj.activities.map((act, aIdx) => (
                                                        <li key={aIdx}>
                                                            <b>[{act.categoryTag}] {act.staffName} ({act.position}):</b> {act.activity}
                                                            {act.obstacleNote && <span className="text-rose-600 font-bold"> (Kendala: {act.obstacleNote})</span>}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* III. REKAP KENDALA */}
                                {weeklyData?.obstacleList && weeklyData.obstacleList.length > 0 && (
                                    <div className="space-y-2">
                                        <h5 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">III. Rekap Kendala / Hambatan Lapangan</h5>
                                        <table className="w-full text-xs text-left border border-slate-200">
                                            <thead className="bg-slate-50 font-bold border-b border-slate-200">
                                                <tr>
                                                    <th className="p-2 border-r">Tgl</th>
                                                    <th className="p-2 border-r">Staf</th>
                                                    <th className="p-2 border-r">Pekerjaan</th>
                                                    <th className="p-2">Uraian Kendala</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200">
                                                {weeklyData.obstacleList.map((obs, idx) => (
                                                    <tr key={idx}>
                                                        <td className="p-2 border-r">{obs.date}</td>
                                                        <td className="p-2 border-r font-bold">{obs.staffName}</td>
                                                        <td className="p-2 border-r">{obs.activity}</td>
                                                        <td className="p-2 text-rose-700 font-medium">{obs.obstacleNote}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* SIGNATURE BLOCK */}
                                <div className="pt-8 flex justify-end">
                                    <div className="text-center space-y-16">
                                        <div>
                                            <p className="text-xs font-medium">Padang, {dayjs().format('DD MMMM YYYY')}</p>
                                            <p className="text-xs font-bold uppercase mt-1">Kepala Bidang Sarana</p>
                                        </div>
                                        <div className="space-y-0.5">
                                            <p className="text-xs font-bold underline">{weeklyData?.kabid?.name || 'Ravi Kurnia'}</p>
                                            <p className="text-[10px] text-slate-600 font-mono">
                                                NIY. {customKabidNiy || weeklyData?.kabid?.niy || user?.nip || user?.username || ''}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* ============================================================== */}
                                {/* HALAMAN LAMPIRAN DOKUMENTASI FOTO KEGIATAN */}
                                {/* ============================================================== */}
                                <div className="pt-10 mt-10 border-t-2 border-dashed border-slate-300 print:border-none print:pt-0 print:mt-0" style={{ pageBreakBefore: 'always', breakBefore: 'page' }}>
                                    {/* KOP LAMPIRAN */}
                                    <div className="text-center border-b-2 border-slate-800 pb-3 space-y-1">
                                        <h3 className="text-[10px] font-black tracking-widest text-slate-500 uppercase">LAMPIRAN DOKUMENTASI LAPANGAN</h3>
                                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                                            FOTO BUKTI AKTIVITAS HARIAN STAF BIDANG SARANA
                                        </h4>
                                        <p className="text-xs font-bold text-slate-600">
                                            Periode: {weeklyData?.period?.formattedPeriod}
                                        </p>
                                    </div>

                                    {/* DAFTAR FOTO DOKUMENTASI */}
                                    {weeklyData?.documentationPhotos && weeklyData.documentationPhotos.length > 0 ? (
                                        <div className="pt-6 space-y-4">
                                            <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-100">
                                                <span className="font-bold">Total Foto Terlampir: {weeklyData.documentationPhotos.length} Foto Dokumentasi</span>
                                                <span className="text-[10px] text-slate-400 italic">*Foto diunggah langsung oleh staf sarana saat pelaporan harian</span>
                                            </div>

                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                {weeklyData.documentationPhotos.map((doc, pIdx) => (
                                                    <div key={pIdx} className="bg-slate-50 border border-slate-200 rounded-2xl p-2.5 space-y-2 flex flex-col justify-between break-inside-avoid shadow-2xs">
                                                        <div className="w-full h-44 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center">
                                                            <img 
                                                                src={getMediaUrl(doc.photoUrl)} 
                                                                alt={doc.activity} 
                                                                className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform" 
                                                                onClick={() => setLightboxPhoto(getMediaUrl(doc.photoUrl))}
                                                                onError={(e) => {
                                                                    e.target.onerror = null;
                                                                    e.target.src = 'https://placehold.co/400x300?text=Foto+Dokumentasi';
                                                                }}
                                                            />
                                                        </div>
                                                        <div className="space-y-1 text-left">
                                                            <div className="flex items-center justify-between gap-1">
                                                                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                                                                    {doc.dateShort}
                                                                </span>
                                                                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-200/60 text-slate-600">
                                                                    {doc.categoryTag}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs font-black text-slate-800 line-clamp-1">
                                                                {doc.staffName} <span className="text-[10px] font-normal text-slate-500">({doc.position})</span>
                                                            </p>
                                                            <p className="text-[11px] text-slate-600 font-medium line-clamp-2 leading-tight">
                                                                {doc.activity}
                                                            </p>
                                                            {doc.obstacleNote && (
                                                                <p className="text-[10px] text-rose-600 font-bold bg-rose-50 p-1 rounded">
                                                                    ⚠️ {doc.obstacleNote}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="pt-12 pb-12 text-center text-slate-400 space-y-2">
                                            <Camera size={36} className="mx-auto text-slate-300" />
                                            <p className="text-xs italic">Tidak ada lampiran foto dokumentasi lapangan pada rentang tanggal ini.</p>
                                        </div>
                                    )}

                                    {/* Catatan Kaki Lampiran */}
                                    <div className="pt-8 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-400 mt-6">
                                        <span>Sistem Informasi Manajemen Aset & Sarpras Yayasan Dar El-Iman Padang</span>
                                        <span>Halaman Lampiran Dokumentasi Foto Kegiatan Lapangan</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ============================================================== */}
                    {/* TAB: DELEGASI PENUGASAN (KABID & STAFF) */}
                    {/* ============================================================== */}
                    {activeTab === 'penugasan' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            {isKabid && (
                                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div>
                                            <h3 className="text-base font-black text-slate-800">Manajemen Delegasi Penugasan</h3>
                                            <p className="text-xs text-slate-400 font-medium">Berikan penugasan berbatas waktu kepada staf bidang sarana.</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {!routinePurged && (
                                                <button
                                                    onClick={handlePurgeRoutine}
                                                    className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                                    title="Hapus semua tugas rutin otomatis yang menumpuk di database (hanya 1 kali pakai)"
                                                >
                                                    <Trash2 size={14} /> Bersihkan Tugas Rutin Otomatis
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setShowAssignmentForm(!showAssignmentForm)}
                                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                                            >
                                                {showAssignmentForm ? 'Tutup Form' : '+ Buat Penugasan Baru'}
                                            </button>
                                        </div>
                                    </div>

                                    {showAssignmentForm && (
                                        <form onSubmit={handleCreateAssignment} className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-xs font-bold text-slate-700 block mb-1">Judul Penugasan</label>
                                                    <input 
                                                        required 
                                                        placeholder="Misal: Perbaikan AC Ruang Guru Gedung B"
                                                        value={assignmentForm.title}
                                                        onChange={(e) => setAssignmentForm({ ...assignmentForm, title: e.target.value })}
                                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-slate-700 block mb-1">Ditugaskan Kepada</label>
                                                    <select
                                                        required
                                                        value={assignmentForm.assigneeId}
                                                        onChange={(e) => setAssignmentForm({ ...assignmentForm, assigneeId: parseInt(e.target.value) })}
                                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500"
                                                    >
                                                        <option value="">Pilih Staf Sarana</option>
                                                        {staffList.map(s => (
                                                            <option key={s.id} value={s.id}>{s.name} ({s.position || 'Staf'})</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-slate-700 block mb-1">Kategori Divisi</label>
                                                    <select
                                                        value={assignmentForm.category}
                                                        onChange={(e) => setAssignmentForm({ ...assignmentForm, category: e.target.value })}
                                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none"
                                                    >
                                                        {DIVISION_TAGS.map(d => (
                                                            <option key={d.key} value={d.key}>{d.label}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-slate-700 block mb-1">Batas Waktu (Deadline)</label>
                                                    <input 
                                                        type="date"
                                                        required
                                                        value={assignmentForm.dueDate}
                                                        onChange={(e) => setAssignmentForm({ ...assignmentForm, dueDate: e.target.value })}
                                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none"
                                                    />
                                                </div>
                                                <div className="md:col-span-2">
                                                    <label className="text-xs font-bold text-slate-700 block mb-1">Rincian Instruksi</label>
                                                    <textarea 
                                                        rows="2"
                                                        required
                                                        placeholder="Instruksi spesifik pengerjaan..."
                                                        value={assignmentForm.description}
                                                        onChange={(e) => setAssignmentForm({ ...assignmentForm, description: e.target.value })}
                                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </div>
                                            </div>
                                            <button 
                                                type="submit" 
                                                disabled={saving}
                                                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                            >
                                                <Send size={14} /> Kirim Penugasan
                                            </button>
                                        </form>
                                    )}
                                </div>
                            )}

                            {/* Assignments List */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {assignments.length === 0 ? (
                                    <div className="col-span-full p-12 text-center bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400 italic text-xs">
                                        Belum ada daftar penugasan aktif.
                                    </div>
                                ) : (
                                    assignments.map(task => (
                                        <div key={task.id} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                                        {task.category || 'UMUM'}
                                                    </span>
                                                    <h4 className="text-sm font-bold text-slate-800 mt-1">{task.title}</h4>
                                                    <p className="text-xs text-slate-500 mt-0.5">{task.description}</p>
                                                </div>
                                                <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase ${
                                                    task.progressPercentage === 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                                }`}>
                                                    {task.progressPercentage}%
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                                                <div className="flex items-center gap-1 font-bold">
                                                    <User size={12} className="text-slate-400" /> {task.assignee?.name}
                                                </div>
                                                <div className="flex items-center gap-1 text-[11px]">
                                                    <Clock size={12} className="text-slate-400" /> Deadline: {dayjs(task.dueDate).format('DD MMM YYYY')}
                                                </div>
                                            </div>

                                            {/* Progress Slider */}
                                            {(user.id === task.assigneeId || isKabid) && (
                                                <div className="space-y-1 pt-1">
                                                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
                                                        <span>Update Progress</span>
                                                        <span>{task.progressPercentage}%</span>
                                                    </div>
                                                    <input 
                                                        type="range"
                                                        min="0"
                                                        max="100"
                                                        step="10"
                                                        value={task.progressPercentage}
                                                        onChange={(e) => handleUpdateTaskProgress(task.id, e.target.value)}
                                                        className="w-full accent-blue-600 cursor-pointer"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* AI ANALYSIS MODAL */}
            {isAiModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full p-6 space-y-4 border border-slate-100 max-h-[90vh] flex flex-col">
                        {/* MODAL HEADER */}
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-400 to-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-amber-500/20">
                                    <Sparkles size={20} />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-slate-800">
                                        {aiAnalysisType === 'OBSTACLE_SOLUTIONS' 
                                            ? '✨ Rekomendasi Solusi AI Kendala Lapangan' 
                                            : (aiAnalysisType === 'TEAM_PERFORMANCE' 
                                                ? '✨ Evaluasi Produktivitas & Kinerja Tim' 
                                                : '✨ Ringkasan Eksekutif & Analitik Kinerja Tim')}
                                    </h3>
                                    <p className="text-xs text-slate-400 font-medium">Didukung Google Gemini AI - Analisis multi-hari terintegrasi</p>
                                </div>
                            </div>
                            <button onClick={() => setIsAiModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-xl transition-all cursor-pointer">
                                <X size={20} />
                            </button>
                        </div>

                        {/* MODAL DATE RANGE & FILTER TOOLBAR */}
                        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2.5">
                            <div className="flex flex-wrap items-center justify-between gap-2.5">
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                                    <Calendar size={14} className="text-slate-400" />
                                    <span>Rentang Tanggal:</span>
                                    <input 
                                        type="date"
                                        value={aiStartDate}
                                        onChange={(e) => setAiStartDate(e.target.value)}
                                        className="bg-white border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer focus:ring-2 focus:ring-blue-500"
                                    />
                                    <span className="text-slate-400">s.d.</span>
                                    <input 
                                        type="date"
                                        value={aiEndDate}
                                        onChange={(e) => setAiEndDate(e.target.value)}
                                        className="bg-white border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div className="flex items-center gap-1.5">
                                    <select
                                        value={aiAnalysisType}
                                        onChange={(e) => setAiAnalysisType(e.target.value)}
                                        className="bg-white border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
                                    >
                                        <option value="DAILY_DIGEST">🎯 Ringkasan Eksekutif</option>
                                        <option value="TEAM_PERFORMANCE">📊 Evaluasi Tim</option>
                                        <option value="OBSTACLE_SOLUTIONS">⚠️ Solusi Kendala</option>
                                    </select>
                                    <button
                                        onClick={() => runAiAnalysis(aiAnalysisType, aiStartDate, aiEndDate)}
                                        disabled={loadingAi}
                                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                                    >
                                        {loadingAi ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                                        Analisis Ulang
                                    </button>
                                </div>
                            </div>

                            {/* ANALYSIS METADATA PILLS */}
                            {aiAnalysisMeta && !loadingAi && (
                                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/60 text-[11px] font-bold text-slate-600">
                                    <span className="bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-lg">
                                        📅 {aiAnalysisMeta.period}
                                    </span>
                                    <span className="bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-lg">
                                        📋 {aiAnalysisMeta.totalActivities} Butir Pekerjaan Teranalisis
                                    </span>
                                    {aiAnalysisMeta.totalObstacles > 0 && (
                                        <span className="bg-rose-100 text-rose-800 px-2.5 py-0.5 rounded-lg">
                                            ⚠️ {aiAnalysisMeta.totalObstacles} Kendala Lapangan
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* MODAL CONTENT BODY */}
                        <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar text-xs sm:text-sm text-slate-700 leading-relaxed">
                            {loadingAi ? (
                                <div className="h-56 flex flex-col items-center justify-center gap-3 text-slate-400">
                                    <Loader2 className="animate-spin text-amber-500" size={36} />
                                    <span className="font-bold text-slate-600">Gemini AI sedang memproses laporan seluruh staf pada rentang tanggal terpilih...</span>
                                    <span className="text-[11px] text-slate-400">Mengevaluasi pembagian beban kerja, efisiensi tugas, dan solusi kendala...</span>
                                </div>
                            ) : (
                                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 whitespace-pre-line font-medium leading-relaxed shadow-2xs">
                                    {aiAnalysisResult}
                                </div>
                            )}
                        </div>

                        {/* MODAL FOOTER */}
                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                            <button
                                onClick={() => {
                                    if (aiAnalysisResult) {
                                        navigator.clipboard.writeText(aiAnalysisResult);
                                        setCopiedAi(true);
                                        setTimeout(() => setCopiedAi(false), 2000);
                                    }
                                }}
                                disabled={loadingAi || !aiAnalysisResult}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                                {copiedAi ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                                {copiedAi ? 'Tersalin ke Clipboard!' : 'Salin Teks Analisis'}
                            </button>

                            <button
                                onClick={() => setIsAiModalOpen(false)}
                                className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer shadow-sm"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* LIGHTBOX PHOTO MODAL */}
            {lightboxPhoto && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
                    onClick={() => setLightboxPhoto(null)}
                >
                    <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl">
                        <img src={getMediaUrl(lightboxPhoto)} alt="Bukti Resolusi Penuh" className="max-w-full max-h-[85vh] object-contain rounded-2xl" />
                        <button 
                            onClick={() => setLightboxPhoto(null)}
                            className="absolute top-3 right-3 p-2 bg-black/60 text-white rounded-full hover:bg-black/80 transition-all"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
            )}

            {/* LIVE IN-APP CAMERA MODAL */}
            {cameraModalConfig.isOpen && (
                <LiveCameraModal
                    isOpen={cameraModalConfig.isOpen}
                    pointIndex={cameraModalConfig.index}
                    period={cameraModalConfig.period}
                    onClose={() => setCameraModalConfig({ isOpen: false, index: null, period: 'morning' })}
                    onCapture={(capturedDataUrl, pIdx, pPeriod) => {
                        handlePhotoUpload(pIdx, capturedDataUrl, pPeriod);
                    }}
                />
            )}
        </div>
    );
};

/**
 * Interactive Live Camera Viewfinder Modal for Real-Time Field Photo Documentation
 */
const LiveCameraModal = ({ isOpen, onClose, onCapture, pointIndex, period }) => {
    const videoRef = useRef(null);
    const [stream, setStream] = useState(null);
    const [capturedImage, setCapturedImage] = useState(null);
    const [cameraFacing, setCameraFacing] = useState('environment'); // 'environment' | 'user'
    const [cameraError, setCameraError] = useState(null);
    const [isStarting, setIsStarting] = useState(true);
    const [isVideoReady, setIsVideoReady] = useState(false);
    const [captureFeedback, setCaptureFeedback] = useState(null);

    // Start video stream
    useEffect(() => {
        if (!isOpen) return;

        let activeStream = null;
        let isCancelled = false;

        const startCamera = async () => {
            setIsStarting(true);
            setIsVideoReady(false);
            setCameraError(null);
            setCaptureFeedback(null);

            try {
                if (stream) {
                    stream.getTracks().forEach(t => t.stop());
                }

                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    throw new Error('Kamera langsung (WebRTC) tidak didukung pada browser ini atau membutuhkan koneksi aman (HTTPS).');
                }

                const constraints = {
                    video: {
                        facingMode: { ideal: cameraFacing },
                        width: { ideal: 1920 },
                        height: { ideal: 1080 }
                    },
                    audio: false
                };

                const newStream = await navigator.mediaDevices.getUserMedia(constraints);
                if (isCancelled) {
                    newStream.getTracks().forEach(t => t.stop());
                    return;
                }

                activeStream = newStream;
                setStream(newStream);

                if (videoRef.current) {
                    const video = videoRef.current;
                    video.srcObject = newStream;
                    video.muted = true;
                    video.defaultMuted = true;
                    video.playsInline = true;
                    video.setAttribute('playsinline', '');
                    video.setAttribute('webkit-playsinline', '');
                    try {
                        await video.play();
                    } catch (e) {
                        console.warn('Video auto-play warning:', e);
                    }
                }
            } catch (err) {
                console.error('Camera access error:', err);
                setCameraError(
                    'Tidak dapat mengakses kamera langsung. Pastikan izin kamera aktif atau gunakan tombol Kamera Bawaan HP di bawah.'
                );
                setIsStarting(false);
            }
        };

        startCamera();

        return () => {
            isCancelled = true;
            if (activeStream) {
                activeStream.getTracks().forEach(t => t.stop());
            }
        };
    }, [isOpen, cameraFacing]);

    const stopStream = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    };

    const takeSnapshot = async () => {
        setCaptureFeedback(null);

        // 1. Try modern W3C ImageCapture API first (Chrome Android & Desktop)
        // Captures directly from the camera sensor at native resolution, completely avoiding canvas black frame bugs!
        const track = stream?.getVideoTracks?.()?.[0];
        if (typeof window !== 'undefined' && 'ImageCapture' in window && track && track.readyState === 'live') {
            try {
                const imageCapture = new window.ImageCapture(track);
                const blob = await imageCapture.takePhoto();
                if (blob && blob.size > 1000) {
                    const dataUrl = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });
                    if (dataUrl) {
                        setCapturedImage(dataUrl);
                        return;
                    }
                }
            } catch (icErr) {
                console.warn('ImageCapture fallback to canvas drawImage:', icErr);
            }
        }

        // 2. Fallback: Draw frame from <video> element to HTML5 Canvas
        if (!videoRef.current) return;
        const video = videoRef.current;

        if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
            setCaptureFeedback('Lensa kamera sedang memuat frame. Mohon tunggu 1 detik lalu jepret lagi.');
            return;
        }

        const width = video.videoWidth || 1280;
        const height = video.videoHeight || 720;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(video, 0, 0, width, height);

        // Verify canvas is not pure pitch black (0,0,0)
        try {
            const sampleW = Math.min(width, 30);
            const sampleH = Math.min(height, 30);
            const imgData = ctx.getImageData(0, 0, sampleW, sampleH).data;
            let sum = 0;
            for (let i = 0; i < imgData.length; i += 4) {
                sum += imgData[i] + imgData[i + 1] + imgData[i + 2];
            }
            const avg = sum / (sampleW * sampleH * 3);
            if (avg < 2) {
                setCaptureFeedback('Frame terdeteksi gelap kosong. Tunggu 1 detik atau gunakan Kamera Bawaan HP.');
                return;
            }
        } catch (e) {
            console.warn('Black frame check warning:', e);
        }

        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        setCapturedImage(dataUrl);
    };

    const retake = () => {
        setCapturedImage(null);
        setCaptureFeedback(null);
    };

    const confirmUsePhoto = () => {
        if (capturedImage) {
            onCapture(capturedImage, pointIndex, period);
            stopStream();
            onClose();
        }
    };

    const handleClose = () => {
        stopStream();
        setCapturedImage(null);
        setCaptureFeedback(null);
        onClose();
    };

    const switchCamera = () => {
        setIsVideoReady(false);
        setIsStarting(true);
        setCameraFacing(prev => prev === 'environment' ? 'user' : 'environment');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
            <div className="relative w-full max-w-lg bg-slate-950 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col max-h-[95vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-4 bg-slate-900/90 text-white z-10 border-b border-slate-800">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                            <Camera size={18} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black tracking-tight">Kamera Langsung</h3>
                            <p className="text-[10px] text-slate-400">Bukti kegiatan {period === 'morning' ? 'Sesi Pagi' : 'Sesi Siang'}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Viewfinder / Preview */}
                <div className="relative flex-1 bg-black flex items-center justify-center min-h-[320px] sm:min-h-[420px] overflow-hidden">
                    {cameraError ? (
                        <div className="p-6 text-center text-slate-300 space-y-4 max-w-sm">
                            <AlertCircle size={40} className="mx-auto text-rose-500" />
                            <div className="space-y-1">
                                <h4 className="text-xs font-black text-white">Kamera Langsung Terkendala</h4>
                                <p className="text-[11px] text-slate-400">{cameraError}</p>
                            </div>
                            <div className="pt-2 flex flex-col gap-2">
                                <label className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-500/20 active:scale-95">
                                    <Camera size={16} />
                                    <span>Gunakan Kamera Bawaan HP</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        className="hidden"
                                        onChange={(e) => {
                                            if (e.target.files && e.target.files[0]) {
                                                onCapture(e.target.files[0], pointIndex, period);
                                                handleClose();
                                            }
                                        }}
                                    />
                                </label>
                                <button
                                    type="button"
                                    onClick={switchCamera}
                                    className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all"
                                >
                                    Coba Alihkan Kamera
                                </button>
                            </div>
                        </div>
                    ) : capturedImage ? (
                        <div className="relative w-full h-full flex items-center justify-center bg-black">
                            <img 
                                src={capturedImage} 
                                alt="Hasil Tangkapan Kamera" 
                                className="w-full h-full object-contain max-h-[60vh]"
                            />
                            <div className="absolute top-3 left-3 bg-emerald-500/90 backdrop-blur-sm text-white px-2.5 py-1 rounded-xl text-[10px] font-bold shadow-md flex items-center gap-1.5">
                                <Check size={12} strokeWidth={3} />
                                <span>Foto Siap Digunakan</span>
                            </div>
                        </div>
                    ) : (
                        <>
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                onLoadedMetadata={() => {
                                    if (videoRef.current) {
                                        videoRef.current.play().catch(e => console.warn(e));
                                    }
                                }}
                                onCanPlay={() => {
                                    setIsVideoReady(true);
                                    setIsStarting(false);
                                }}
                                onPlaying={() => {
                                    setIsVideoReady(true);
                                    setIsStarting(false);
                                }}
                                className="w-full h-full object-contain max-h-[60vh]"
                            />

                            {/* Camera Readiness Badge */}
                            {isVideoReady && !isStarting && (
                                <div className="absolute top-3 right-3 bg-emerald-600/90 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 shadow-md">
                                    <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                                    <span>Lensa Aktif</span>
                                </div>
                            )}

                            {isStarting && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/75 text-white">
                                    <Loader2 className="animate-spin text-blue-500" size={32} />
                                    <span className="text-xs font-bold">Menghubungkan ke lensa kamera...</span>
                                    <span className="text-[10px] text-slate-400">Pastikan izin kamera disetujui</span>
                                </div>
                            )}

                            {/* Alert Feedback Banner */}
                            {captureFeedback && (
                                <div className="absolute bottom-4 inset-x-4 bg-amber-500/90 text-slate-950 px-3 py-2 rounded-xl text-xs font-bold text-center shadow-lg animate-in slide-in-from-bottom-2">
                                    {captureFeedback}
                                </div>
                            )}

                            {/* Visual Grid Lines */}
                            <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 opacity-20 border border-white/20">
                                <div className="border-r border-b border-white"></div>
                                <div className="border-r border-b border-white"></div>
                                <div className="border-b border-white"></div>
                                <div className="border-r border-b border-white"></div>
                                <div className="border-r border-b border-white"></div>
                                <div className="border-b border-white"></div>
                                <div className="border-r border-white"></div>
                                <div className="border-r border-white"></div>
                                <div></div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="p-4 bg-slate-900 text-white flex items-center justify-around border-t border-slate-800">
                    {capturedImage ? (
                        <div className="flex items-center gap-3 w-full">
                            <button
                                type="button"
                                onClick={retake}
                                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                            >
                                <RefreshCw size={15} /> Foto Ulang
                            </button>
                            <button
                                type="button"
                                onClick={confirmUsePhoto}
                                className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-blue-500/30 cursor-pointer active:scale-95"
                            >
                                <Check size={16} strokeWidth={3} /> Gunakan Foto Ini
                            </button>
                        </div>
                    ) : !cameraError ? (
                        <div className="flex items-center justify-between w-full px-4 sm:px-6">
                            {/* Switch Camera Front/Back */}
                            <button
                                type="button"
                                onClick={switchCamera}
                                className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl transition-all cursor-pointer active:scale-90"
                                title="Balik Kamera (Depan / Belakang)"
                            >
                                <RefreshCw size={18} />
                            </button>

                            {/* Big Circular Shutter Button */}
                            <button
                                type="button"
                                onClick={takeSnapshot}
                                disabled={isStarting || !isVideoReady}
                                className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-white p-1 flex items-center justify-center shadow-xl active:scale-90 transition-transform cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                title="Jepret Foto"
                            >
                                <div className="w-full h-full rounded-full bg-blue-600 hover:bg-blue-700 border-4 border-white transition-all flex items-center justify-center text-white">
                                    <Camera size={24} />
                                </div>
                            </button>

                            {/* Alternative: Native Camera Upload (Clear & Prominent) */}
                            <label 
                                className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-2xl transition-all cursor-pointer active:scale-90 flex items-center gap-1.5 border border-slate-700 shadow-sm"
                                title="Gunakan Aplikasi Kamera Bawaan HP Langsung"
                            >
                                <Camera size={16} className="text-amber-400" />
                                <span className="text-[11px] font-bold">Kamera HP</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            onCapture(e.target.files[0], pointIndex, period);
                                            handleClose();
                                        }
                                    }}
                                />
                            </label>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={handleClose}
                            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                        >
                            Tutup Kamera
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LaporanStaff;
