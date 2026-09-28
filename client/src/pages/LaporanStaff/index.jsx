import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    FileText, Calendar, Plus, Save, RefreshCw, Loader2, User, Camera, X, 
    Clock, CheckCircle, CheckCircle2, AlertTriangle, AlertCircle, Sparkles, 
    Search, Filter, Download, Printer, Award, TrendingUp, ChevronRight, 
    ChevronDown, MessageSquare, Send, CheckSquare, Eye, ShieldCheck, Tag,
    BookOpen
} from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '../../lib/axios';
import dayjs from 'dayjs';
import 'dayjs/locale/id';

import SetoranHafalanTab from '../../components/SetoranHafalanTab';
import { DIVISION_TAGS, ROUTINE_TEMPLATES } from './constants';

// Subcomponents
import ExecutiveDashboardTab from './tabs/ExecutiveDashboardTab';
import TeamMonitoringTab from './tabs/TeamMonitoringTab';
import DailyReportFormTab from './tabs/DailyReportFormTab';
import DisciplineMatrixTab from './tabs/DisciplineMatrixTab';
import WeeklyPdfTab from './tabs/WeeklyPdfTab';
import AssignmentsTab from './tabs/AssignmentsTab';

// Modals
import LiveCameraModal from './modals/LiveCameraModal';
import AiAnalysisModal from './modals/AiAnalysisModal';
import LightboxModal from './modals/LightboxModal';

dayjs.locale('id');

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
        if (pos.includes('infrastruktur it') || pos.includes('staff it') || pos.includes('it') || pos.includes('programming') || role.includes('it')) return 'IT';
        if (pos.includes('desainer') || pos.includes('desain')) return 'DESAINER';
        if (pos.includes('manajemen aset') || pos.includes('aset') || pos.includes('inventaris') || pos.includes('asset') || role.includes('aset')) return 'ASET';
        return 'UMUM';
    }, [user.position, user.role]);

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

    // Monitoring Feed Filters & Date Range
    const [reportsFeed, setReportsFeed] = useState([]);
    const [monitoringPreset, setMonitoringPreset] = useState('TODAY');
    const [monitoringStartDate, setMonitoringStartDate] = useState(dayjs().format('YYYY-MM-DD'));
    const [monitoringEndDate, setMonitoringEndDate] = useState(dayjs().format('YYYY-MM-DD'));
    const [selectedStaffId, setSelectedStaffId] = useState('');
    const [filterCategory, setFilterCategory] = useState('ALL');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [verifyingReportId, setVerifyingReportId] = useState(null);
    const [verificationForm, setVerificationForm] = useState({ status: 'VERIFIED', feedbackNote: '' });
    const [activePointReview, setActivePointReview] = useState(null);
    const [pointReviewForm, setPointReviewForm] = useState({ status: 'APPROVED', feedbackNote: '' });
    const [savingPointReview, setSavingPointReview] = useState(false);
    const [remindingStaff, setRemindingStaff] = useState(false);

    // Staff Form States
    const [morningPoints, setMorningPoints] = useState([{ text: '', categoryTag: 'UMUM', status: 'COMPLETED', obstacleNote: '', photos: [] }]);
    const [afternoonPoints, setAfternoonPoints] = useState([{ text: '', categoryTag: 'UMUM', status: 'COMPLETED', obstacleNote: '', photos: [] }]);
    const [personalStats, setPersonalStats] = useState(null);
    const [uploadingPhotoIndex, setUploadingPhotoIndex] = useState(null);
    const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
    const [showTemplateAccordion, setShowTemplateAccordion] = useState(false);
    const [showAllTemplates, setShowAllTemplates] = useState(false);
    const [showMissedDates, setShowMissedDates] = useState(false);
    const [mobileSessionTab, setMobileSessionTab] = useState('ALL');
    const [cameraModalConfig, setCameraModalConfig] = useState({ isOpen: false, index: null, period: 'morning' });
    const currentLoadedDateRef = useRef(null);

    // Staff Custom Templates
    const customTemplatesKey = `staff_custom_templates_v2_${user?.id || 'default'}`;
    const [staffCustomTemplates, setStaffCustomTemplates] = useState(() => {
        try {
            const saved = localStorage.getItem(customTemplatesKey);
            if (saved) return JSON.parse(saved);
        } catch (e) {
            console.error('Error loading custom templates:', e);
        }
        return [];
    });
    const [newTemplateText, setNewTemplateText] = useState('');
    const [newTemplateCategory, setNewTemplateCategory] = useState(userDivision || 'ASET');
    const [isAddingTemplate, setIsAddingTemplate] = useState(false);
    const [editingTemplateId, setEditingTemplateId] = useState(null);
    const [editingTemplateText, setEditingTemplateText] = useState('');

    // Kabid Dashboard Data
    const [dashboardData, setDashboardData] = useState(null);

    // AI Analysis Modal & Date Range
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [aiAnalysisResult, setAiAnalysisResult] = useState('');
    const [loadingAi, setLoadingAi] = useState(false);
    const [aiAnalysisType, setAiAnalysisType] = useState('DAILY_DIGEST');
    const [aiStartDate, setAiStartDate] = useState(dayjs().startOf('week').add(1, 'day').format('YYYY-MM-DD'));
    const [aiEndDate, setAiEndDate] = useState(dayjs().format('YYYY-MM-DD'));
    const [aiRangePreset, setAiRangePreset] = useState('WEEK');
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

    // Initial Load & Tab switching
    useEffect(() => {
        if (activeTab === 'dashboard' && isKabid) {
            fetchDashboardAnalytics();
        } else if (activeTab === 'monitoring' && isKabid) {
            fetchReportsFeed();
            fetchStaffList();
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

    // Fetch reports feed whenever filters/dates change in monitoring tab
    useEffect(() => {
        if (activeTab === 'monitoring' && isKabid) {
            fetchReportsFeed();
        }
    }, [monitoringStartDate, monitoringEndDate, selectedStaffId, filterCategory, filterStatus]);

    // Auto-Save Draft to LocalStorage
    useEffect(() => {
        if (activeTab === 'laporan' && !loading && currentLoadedDateRef.current === selectedDate) {
            const hasContent = morningPoints.some(p => p.text?.trim() || p.photos?.length > 0) || afternoonPoints.some(p => p.text?.trim() || p.photos?.length > 0);
            if (hasContent) {
                const draftKey = `draft_laporan_${user.id || 'default'}_${selectedDate}`;
                localStorage.setItem(draftKey, JSON.stringify({ morning: morningPoints, afternoon: afternoonPoints }));
            }
        }
    }, [morningPoints, afternoonPoints, selectedDate, activeTab, isKabid, loading, user.id]);

    // Client-side photo compression
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
                    ctx.drawImage(img, 0, 0, width, height);

                    const compressed = canvas.toDataURL('image/jpeg', quality);
                    resolve(compressed);
                } catch (err) {
                    reject(err);
                }
            };

            img.onerror = (e) => {
                if (objectUrl) URL.revokeObjectURL(objectUrl);
                reject(new Error('Gagal memuat gambar untuk kompresi.'));
            };

            if (typeof fileOrBlobOrDataUrl === 'string') {
                img.src = fileOrBlobOrDataUrl;
            } else if (fileOrBlobOrDataUrl instanceof Blob || fileOrBlobOrDataUrl instanceof File) {
                objectUrl = URL.createObjectURL(fileOrBlobOrDataUrl);
                img.src = objectUrl;
            } else {
                reject(new Error('Format berkas gambar tidak didukung.'));
            }
        });
    };

    // -------------------------------------------------------------
    // API CALLS: STAFF
    // -------------------------------------------------------------
    const fetchMyReport = async () => {
        try {
            setLoading(true);
            const targetDateToLoad = selectedDate;
            const res = await api.get('/laporan', {
                params: { date: targetDateToLoad }
            });
            if (res.data.success) {
                const rep = res.data.myReport;
                const pts = rep?.metadata?.manualPoints;
                if (pts && (pts.morning?.length > 0 || pts.afternoon?.length > 0 || pts.morningPoints?.length > 0 || pts.afternoonPoints?.length > 0)) {
                    const m = pts.morning || pts.morningPoints || [];
                    const a = pts.afternoon || pts.afternoonPoints || [];
                    setMorningPoints(m.length > 0 ? m : [{ text: '', categoryTag: userDivision || 'UMUM', status: 'COMPLETED', obstacleNote: '', photos: [] }]);
                    setAfternoonPoints(a.length > 0 ? a : [{ text: '', categoryTag: userDivision || 'UMUM', status: 'COMPLETED', obstacleNote: '', photos: [] }]);
                    setHasRestoredDraft(false);
                    currentLoadedDateRef.current = targetDateToLoad;
                } else {
                    const draftKey = `draft_laporan_${user.id || 'default'}_${targetDateToLoad}`;
                    const savedDraft = localStorage.getItem(draftKey);
                    if (savedDraft) {
                        try {
                            const parsed = JSON.parse(savedDraft);
                            if (parsed.morning?.length > 0 || parsed.afternoon?.length > 0) {
                                setMorningPoints(parsed.morning || [{ text: '', categoryTag: userDivision || 'UMUM', status: 'COMPLETED', obstacleNote: '', photos: [] }]);
                                setAfternoonPoints(parsed.afternoon || [{ text: '', categoryTag: userDivision || 'UMUM', status: 'COMPLETED', obstacleNote: '', photos: [] }]);
                                setHasRestoredDraft(true);
                                currentLoadedDateRef.current = targetDateToLoad;
                                return;
                            }
                        } catch (e) {
                            console.error('Failed to parse draft', e);
                        }
                    }
                    setMorningPoints([{ text: '', categoryTag: userDivision || 'UMUM', status: 'COMPLETED', obstacleNote: '', photos: [] }]);
                    setAfternoonPoints([{ text: '', categoryTag: userDivision || 'UMUM', status: 'COMPLETED', obstacleNote: '', photos: [] }]);
                    setHasRestoredDraft(false);
                    currentLoadedDateRef.current = targetDateToLoad;
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

    const handleSaveReport = async (targetPeriod = null) => {
        try {
            const validMorning = morningPoints.filter(p => (p.text && p.text.trim()) || (p.photos && p.photos.length > 0));
            const validAfternoon = afternoonPoints.filter(p => (p.text && p.text.trim()) || (p.photos && p.photos.length > 0));

            if (targetPeriod === 'morning') {
                if (validMorning.length === 0) {
                    alert('Mohon isi minimal satu uraian kegiatan pada Sesi Pagi sebelum menyimpan.');
                    return;
                }
            } else if (targetPeriod === 'afternoon') {
                if (validAfternoon.length === 0) {
                    alert('Mohon isi minimal satu uraian kegiatan pada Sesi Siang sebelum menyimpan.');
                    return;
                }
            } else {
                if (validMorning.length === 0 && validAfternoon.length === 0) {
                    alert('Mohon isi minimal satu uraian kegiatan pada Sesi Pagi atau Sesi Siang sebelum menyimpan laporan.');
                    return;
                }
            }

            setSaving(true);
            const res = await api.post('/laporan/my', {
                targetDate: selectedDate,
                manualPoints: {
                    morning: validMorning,
                    afternoon: validAfternoon
                }
            });

            if (res.data.success) {
                const draftKey = `draft_laporan_${user.id || 'default'}_${selectedDate}`;
                localStorage.removeItem(draftKey);
                setHasRestoredDraft(false);

                const isOldDate = selectedDate !== dayjs().format('YYYY-MM-DD');
                const formattedDate = dayjs(selectedDate).format('DD/MM/YYYY');
                let periodText = '';
                if (targetPeriod === 'morning') periodText = 'Sesi Pagi ';
                else if (targetPeriod === 'afternoon') periodText = 'Sesi Siang ';

                alert(isOldDate 
                    ? `Alhamdulillah, laporan ${periodText}susulan untuk tanggal ${formattedDate} (WIB) berhasil disimpan!` 
                    : `Alhamdulillah, laporan ${periodText}harian berhasil disimpan!`
                );
                await Promise.all([fetchMyReport(), fetchMyStats()]);
            }
        } catch (error) {
            console.error('Error saving report:', error);
            const errMsg = error.response?.data?.error || 'Gagal menyimpan laporan. Silakan periksa koneksi dan coba lagi.';
            alert(errMsg);
        } finally {
            setSaving(false);
        }
    };

    const handlePhotoUpload = async (index, fileOrDataUrl, period = 'morning') => {
        if (!fileOrDataUrl) return;
        try {
            setUploadingPhotoIndex(`${period}-${index}`);
            const compressedBase64 = await compressImage(fileOrDataUrl);
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
        if (staffCustomTemplates.length === 0) return;
        if (!window.confirm('Kosongkan semua daftar template kegiatan mandiri Anda?')) return;
        saveStaffTemplates([]);
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
            const isSingleDay = monitoringStartDate === monitoringEndDate;
            const res = await api.get('/laporan', {
                params: {
                    date: isSingleDay ? monitoringStartDate : undefined,
                    startDate: monitoringStartDate,
                    endDate: monitoringEndDate,
                    staffId: selectedStaffId || undefined,
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

    const fetchStaffList = async () => {
        try {
            const res = await api.get('/personnel/staff');
            if (res.data.success || res.data.data) {
                setStaffList(res.data.staff || res.data.data || []);
            }
        } catch (e) {
            console.error('Error fetching staff list:', e);
        }
    };

    const fetchAssignments = async () => {
        try {
            const res = await api.get('/personnel/assignments');
            if (res.data.success || res.data.data) {
                setAssignments(res.data.assignments || res.data.data || []);
            }
        } catch (e) {
            console.error('Error fetching assignments:', e);
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

    const handleExportExcelMatrix = () => {
        if (!matrixSummary || matrixSummary.length === 0) return alert('Tidak ada data matriks untuk diekspor.');
        const headers = ['No', 'Nama Staf', 'Jabatan', ...matrixDateRange.map(d => dayjs(d).format('DD/MM'))];
        const rows = matrixSummary.map((st, idx) => {
            const rowData = [idx + 1, st.name, st.position || 'Staf'];
            matrixDateRange.forEach(d => {
                const stat = st.summaryByDate?.[d]?.status || 'BELUM';
                rowData.push(stat === 'LENGKAP' ? 'LENGKAP' : stat === 'PARSIAL' ? 'PARSIAL' : '-');
            });
            return rowData;
        });
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        XLSX.utils.book_append_sheet(wb, ws, `Kedisiplinan_${matrixMonth}`);
        XLSX.writeFile(wb, `Matriks_Kedisiplinan_${matrixMonth}.xlsx`);
    };

    const handleVerifyReport = async (reportId) => {
        try {
            const res = await api.put(`/laporan/${reportId}/verify`, verificationForm);
            if (res.data.success) {
                alert('Laporan berhasil diverifikasi dan staf telah diberitahu!');
                setVerifyingReportId(null);
                fetchReportsFeed();
            }
        } catch (error) {
            console.error('Verification error:', error);
            alert('Gagal memverifikasi laporan.');
        }
    };

    const openPointReviewForm = (reportId, period, pointIndex, existingReview) => {
        setActivePointReview({ reportId, period, pointIndex });
        setPointReviewForm({
            status: existingReview?.status || 'APPROVED',
            feedbackNote: existingReview?.feedbackNote || ''
        });
    };

    const handleSavePointReview = async (reportId, period, pointIndex) => {
        try {
            setSavingPointReview(true);
            const res = await api.put(`/laporan/${reportId}/point-review`, {
                period,
                pointIndex,
                status: pointReviewForm.status,
                feedbackNote: pointReviewForm.feedbackNote
            });
            if (res.data.success) {
                setReportsFeed(prevFeed => prevFeed.map(r => {
                    if (r.id !== reportId) return r;
                    const pts = r.metadata?.manualPoints || { morning: [], afternoon: [] };
                    const targetList = [...(pts[period] || [])];
                    if (targetList[pointIndex]) {
                        targetList[pointIndex] = {
                            ...targetList[pointIndex],
                            review: res.data.review
                        };
                    }
                    return {
                        ...r,
                        metadata: {
                            ...r.metadata,
                            manualPoints: {
                                ...pts,
                                [period]: targetList
                            }
                        }
                    };
                }));
                setActivePointReview(null);
                alert('Ulasan butir kegiatan berhasil disimpan dan notifikasi telah dikirim ke staf!');
            }
        } catch (error) {
            console.error('Failed to save point review:', error);
            alert('Gagal menyimpan ulasan butir kegiatan: ' + (error.response?.data?.error || error.message));
        } finally {
            setSavingPointReview(false);
        }
    };

    const handleDeletePointReview = async (reportId, period, pointIndex) => {
        if (!window.confirm('Hapus ulasan untuk butir kegiatan ini?')) return;
        try {
            setSavingPointReview(true);
            const res = await api.put(`/laporan/${reportId}/point-review`, {
                period,
                pointIndex,
                status: null,
                feedbackNote: ''
            });
            if (res.data.success) {
                setReportsFeed(prevFeed => prevFeed.map(r => {
                    if (r.id !== reportId) return r;
                    const pts = r.metadata?.manualPoints || { morning: [], afternoon: [] };
                    const targetList = [...(pts[period] || [])];
                    if (targetList[pointIndex]) {
                        const updatedItem = { ...targetList[pointIndex] };
                        delete updatedItem.review;
                        targetList[pointIndex] = updatedItem;
                    }
                    return {
                        ...r,
                        metadata: {
                            ...r.metadata,
                            manualPoints: {
                                ...pts,
                                [period]: targetList
                            }
                        }
                    };
                }));
                setActivePointReview(null);
            }
        } catch (error) {
            console.error('Failed to delete point review:', error);
            alert('Gagal menghapus ulasan: ' + (error.response?.data?.error || error.message));
        } finally {
            setSavingPointReview(false);
        }
    };

    const handleRemindStaff = async (targetUserId = null, staffName = null) => {
        try {
            const confirmMsg = targetUserId 
                ? `Kirimkan pengingat pengisian laporan kepada ${staffName} via WhatsApp & Notifikasi Aplikasi?` 
                : `Kirimkan pengingat pengisian laporan kepada SEMUA staf yang belum melengkapi laporan hari ini via WhatsApp & Notifikasi Aplikasi?`;
            
            if (!window.confirm(confirmMsg)) return;

            setRemindingStaff(true);
            const res = await api.post('/laporan/remind-staff', {
                userId: targetUserId || undefined,
                date: selectedDate
            });

            if (res.data.success) {
                alert(res.data.message || 'Pengingat berhasil dikirim ke staf terkait!');
                if (activeTab === 'dashboard') fetchDashboardAnalytics();
            }
        } catch (error) {
            console.error('Error reminding staff:', error);
            alert('Gagal mengirim pengingat: ' + (error.response?.data?.error || error.message));
        } finally {
            setRemindingStaff(false);
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

    return (
        <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500 pb-44 sm:pb-16">
            {/* TOP HEADER */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 sm:gap-4 bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                        <FileText className="w-6 h-6 sm:w-7 sm:h-7" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            <h1 className="text-lg sm:text-2xl font-black text-slate-800 tracking-tight truncate">
                                {isKabid ? (activeTab === 'laporan' ? 'Laporan Harian Kepala Bidang' : 'Manajemen & Kinerja Staf') : 'Laporan Harian Staf'}
                            </h1>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider ${isKabid ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {isKabid ? 'Kepala Bidang Sarana' : (user.position || 'Staff Manajemen Aset')}
                            </span>
                        </div>
                        <p className="text-slate-400 text-[11px] sm:text-sm font-medium mt-0.5 line-clamp-1 sm:line-clamp-none">
                            {isKabid 
                                ? (activeTab === 'laporan' ? 'Catat agenda dan aktivitas kerja harian Kepala Bidang Sarana (Sesi Pagi & Siang), foto bukti lapangan, dan simpan laporan.' : 'Pusat evaluasi kerja, monitoring kendala lapangan, analitik AI, dan rekapitulasi pekanan.')
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
                    {isKabid && (
                        <button
                            onClick={async () => {
                                if (!window.confirm('Kirim rangkuman laporan harian staf hari ini ke WhatsApp Kepala Bidang Sarana?')) return;
                                try {
                                    const res = await api.post('/laporan/send-daily-summary');
                                    alert(res.data.message || 'Rangkuman laporan harian berhasil dikirim ke WhatsApp Kabid!');
                                } catch (err) {
                                    alert(err.response?.data?.error || 'Gagal mengirim rangkuman.');
                                }
                            }}
                            className="px-3 py-1.5 sm:px-3.5 sm:py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0"
                            title="Kirim Rangkuman Harian ke WhatsApp Kabid"
                        >
                            <Send size={14} /> <span className="hidden sm:inline">Kirim Rangkuman WA</span>
                        </button>
                    )}
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
                            onClick={() => setActiveTab('laporan')}
                            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                                activeTab === 'laporan' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                            }`}
                        >
                            <FileText size={16} /> Isi Laporan Harian
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
                        <button
                            onClick={() => setActiveTab('hafalan')}
                            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                                activeTab === 'hafalan' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                            }`}
                        >
                            <BookOpen size={16} /> Setoran Hafalan
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
                        <button
                            onClick={() => setActiveTab('hafalan')}
                            className={`px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                                activeTab === 'hafalan' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                            }`}
                        >
                            <BookOpen size={16} /> Setoran Hafalan
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
                    {/* TAB: KABID DASHBOARD */}
                    {isKabid && activeTab === 'dashboard' && dashboardData && (
                        <ExecutiveDashboardTab
                            dashboardData={dashboardData}
                            selectedDate={selectedDate}
                            setSelectedDate={setSelectedDate}
                            aiRangePreset={aiRangePreset}
                            setAiRangePreset={setAiRangePreset}
                            setAiPreset={setAiPreset}
                            aiStartDate={aiStartDate}
                            setAiStartDate={setAiStartDate}
                            aiEndDate={aiEndDate}
                            setAiEndDate={setAiEndDate}
                            runAiAnalysis={runAiAnalysis}
                            handleRemindStaff={handleRemindStaff}
                            remindingStaff={remindingStaff}
                            setLightboxPhoto={setLightboxPhoto}
                            fetchDashboardAnalytics={fetchDashboardAnalytics}
                        />
                    )}

                    {/* TAB: MONITORING FEED TIM */}
                    {isKabid && activeTab === 'monitoring' && (
                        <TeamMonitoringTab
                            reportsFeed={reportsFeed}
                            setReportsFeed={setReportsFeed}
                            fetchReportsFeed={fetchReportsFeed}
                            monitoringPreset={monitoringPreset}
                            setMonitoringPreset={setMonitoringPreset}
                            monitoringStartDate={monitoringStartDate}
                            setMonitoringStartDate={setMonitoringStartDate}
                            monitoringEndDate={monitoringEndDate}
                            setMonitoringEndDate={setMonitoringEndDate}
                            selectedStaffId={selectedStaffId}
                            setSelectedStaffId={setSelectedStaffId}
                            staffList={staffList}
                            searchQuery={searchQuery}
                            setSearchQuery={setSearchQuery}
                            filterStatus={filterStatus}
                            setFilterStatus={setFilterStatus}
                            filterCategory={filterCategory}
                            setFilterCategory={setFilterCategory}
                            handleRemindStaff={handleRemindStaff}
                            remindingStaff={remindingStaff}
                            setLightboxPhoto={setLightboxPhoto}
                            isKabid={isKabid}
                            activePointReview={activePointReview}
                            setActivePointReview={setActivePointReview}
                            pointReviewForm={pointReviewForm}
                            setPointReviewForm={setPointReviewForm}
                            savingPointReview={savingPointReview}
                            openPointReviewForm={openPointReviewForm}
                            handleSavePointReview={handleSavePointReview}
                            handleDeletePointReview={handleDeletePointReview}
                            verifyingReportId={verifyingReportId}
                            setVerifyingReportId={setVerifyingReportId}
                            verificationForm={verificationForm}
                            setVerificationForm={setVerificationForm}
                            handleVerifyReport={handleVerifyReport}
                        />
                    )}

                    {/* TAB: LAPORAN HARIAN SAYA */}
                    {activeTab === 'laporan' && (
                        <DailyReportFormTab
                            user={user}
                            userDivision={userDivision}
                            selectedDate={selectedDate}
                            setSelectedDate={setSelectedDate}
                            morningPoints={morningPoints}
                            setMorningPoints={setMorningPoints}
                            afternoonPoints={afternoonPoints}
                            setAfternoonPoints={setAfternoonPoints}
                            personalStats={personalStats}
                            saving={saving}
                            handleSaveReport={handleSaveReport}
                            uploadingPhotoIndex={uploadingPhotoIndex}
                            setCameraModalConfig={setCameraModalConfig}
                            handlePhotoUpload={handlePhotoUpload}
                            handleRemovePhoto={handleRemovePhoto}
                            setLightboxPhoto={setLightboxPhoto}
                            staffCustomTemplates={staffCustomTemplates}
                            saveStaffTemplates={saveStaffTemplates}
                            handleResetToDefaultTemplates={handleResetToDefaultTemplates}
                            newTemplateText={newTemplateText}
                            setNewTemplateText={setNewTemplateText}
                            newTemplateCategory={newTemplateCategory}
                            setNewTemplateCategory={setNewTemplateCategory}
                            isAddingTemplate={isAddingTemplate}
                            setIsAddingTemplate={setIsAddingTemplate}
                            handleAddCustomTemplate={handleAddCustomTemplate}
                            editingTemplateId={editingTemplateId}
                            setEditingTemplateId={setEditingTemplateId}
                            editingTemplateText={editingTemplateText}
                            setEditingTemplateText={setEditingTemplateText}
                            handleSaveEditTemplate={handleSaveEditTemplate}
                            handleDeleteCustomTemplate={handleDeleteCustomTemplate}
                            showTemplateAccordion={showTemplateAccordion}
                            setShowTemplateAccordion={setShowTemplateAccordion}
                            showAllTemplates={showAllTemplates}
                            setShowAllTemplates={setShowAllTemplates}
                            showMissedDates={showMissedDates}
                            setShowMissedDates={setShowMissedDates}
                            mobileSessionTab={mobileSessionTab}
                            setMobileSessionTab={setMobileSessionTab}
                            assignments={assignments}
                            convertTaskToReport={convertTaskToReport}
                            applyRoutine={applyRoutine}
                        />
                    )}

                    {/* TAB: MATRIKS KEDISIPLINAN BULANAN */}
                    {isKabid && activeTab === 'matrix' && (
                        <DisciplineMatrixTab
                            matrixSummary={matrixSummary}
                            matrixDateRange={matrixDateRange}
                            matrixMonth={matrixMonth}
                            setMatrixMonth={setMatrixMonth}
                            handleExportExcelMatrix={handleExportExcelMatrix}
                        />
                    )}

                    {/* TAB: LAPORAN MINGGUAN KABID (PDF) */}
                    {isKabid && activeTab === 'weekly-pdf' && (
                        <WeeklyPdfTab
                            weeklyData={weeklyData}
                            weeklyStartDate={weeklyStartDate}
                            setWeeklyStartDate={setWeeklyStartDate}
                            weeklyEndDate={weeklyEndDate}
                            setWeeklyEndDate={setWeeklyEndDate}
                            customKabidNiy={customKabidNiy}
                            setCustomKabidNiy={setCustomKabidNiy}
                            setLightboxPhoto={setLightboxPhoto}
                        />
                    )}

                    {/* TAB: DELEGASI PENUGASAN */}
                    {activeTab === 'penugasan' && (
                        <AssignmentsTab
                            assignments={assignments}
                            staffList={staffList}
                            isKabid={isKabid}
                            user={user}
                            showAssignmentForm={showAssignmentForm}
                            setShowAssignmentForm={setShowAssignmentForm}
                            assignmentForm={assignmentForm}
                            setAssignmentForm={setAssignmentForm}
                            handleCreateAssignment={handleCreateAssignment}
                            handleUpdateTaskProgress={handleUpdateTaskProgress}
                            routinePurged={routinePurged}
                            handlePurgeRoutine={handlePurgeRoutine}
                            saving={saving}
                            convertTaskToReport={convertTaskToReport}
                            setActiveTab={setActiveTab}
                        />
                    )}

                    {/* TAB: SETORAN HAFALAN */}
                    {activeTab === 'hafalan' && (
                        <SetoranHafalanTab isKabid={isKabid} user={user} />
                    )}
                </>
            )}

            {/* MODAL 1: LIVE WEBRTC CAMERA */}
            <LiveCameraModal
                isOpen={cameraModalConfig.isOpen}
                onClose={() => setCameraModalConfig({ isOpen: false, index: null, period: 'morning' })}
                onCapture={(fileOrBlob, pIdx, period) => {
                    handlePhotoUpload(pIdx, fileOrBlob, period);
                }}
                pointIndex={cameraModalConfig.index}
                period={cameraModalConfig.period}
            />

            {/* MODAL 2: AI ANALYSIS */}
            <AiAnalysisModal
                isOpen={isAiModalOpen}
                onClose={() => setIsAiModalOpen(false)}
                loadingAi={loadingAi}
                aiAnalysisType={aiAnalysisType}
                aiAnalysisResult={aiAnalysisResult}
                aiAnalysisMeta={aiAnalysisMeta}
                aiStartDate={aiStartDate}
                setAiStartDate={setAiStartDate}
                aiEndDate={aiEndDate}
                setAiEndDate={setAiEndDate}
                aiRangePreset={aiRangePreset}
                setAiRangePreset={setAiRangePreset}
                setAiPreset={setAiPreset}
                runAiAnalysis={runAiAnalysis}
                copiedAi={copiedAi}
                setCopiedAi={setCopiedAi}
            />

            {/* MODAL 3: LIGHTBOX FOR FULL PHOTO PREVIEW */}
            <LightboxModal
                photoUrl={lightboxPhoto}
                onClose={() => setLightboxPhoto(null)}
            />
        </div>
    );
};

export default LaporanStaff;
