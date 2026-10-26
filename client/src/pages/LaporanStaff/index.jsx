import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    FileText, Calendar, Plus, Save, RefreshCw, Loader2, User, Camera, X,
    Clock, CheckCircle, CheckCircle2, AlertTriangle, AlertCircle, Sparkles,
    Search, Filter, Download, Printer, Award, TrendingUp, ChevronRight,
    ChevronDown, MessageSquare, Send, CheckSquare, Eye, ShieldCheck, Tag,
    BookOpen, Target, GraduationCap
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
import WorkPlanTab from './tabs/WorkPlanTab';
import TrainingTab from './tabs/TrainingTab';

// Modals
import LiveCameraModal from './modals/LiveCameraModal';
import AiAnalysisModal from './modals/AiAnalysisModal';
import LightboxModal from './modals/LightboxModal';

dayjs.locale('id');

class TabErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, info) {
        console.error('Tab rendered error:', error, info);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="bg-white rounded-3xl border border-rose-100 p-8 text-center space-y-3 shadow-sm my-4">
                    <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
                        <AlertCircle size={24} />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800">Gagal Memuat Konten Tab</h3>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                        {this.state.error?.message || 'Terjadi kendala saat merender komponen ini.'}
                    </p>
                    <button
                        onClick={() => { this.setState({ hasError: false }); }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all cursor-pointer"
                    >
                        Coba Lagi
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

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
        return role === 'KABID_SARPRAS' || role === 'KEPALA_BIDANG' || pos.includes('kepala bidang sarana') || pos.includes('kabid sarpras');
    }, [user]);

    const isOnlyKabidSarana = useMemo(() => {
        const role = user.role || '';
        const pos = (user.position || '').toLowerCase();
        return pos.includes('kepala bidang sarana') || pos.includes('kabid sarpras') || role === 'KABID_SARPRAS';
    }, [user.position, user.role]);

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
    const handleSetSelectedDate = (val) => {
        if (!val) return;
        const dateStr = typeof val === 'string' ? val : (val.date || val.target?.value || '');
        if (dateStr && dayjs(dateStr).isValid()) {
            setSelectedDate(dayjs(dateStr).format('YYYY-MM-DD'));
        }
    };
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

    // Staff Form States: Metode PPP (Progress, Problems, Plans) & Legacy Compatibility
    const [completedItems, setCompletedItems] = useState([
        { title: '', output: '', categoryTag: userDivision || 'UMUM', photos: [] }
    ]);
    const [inProgressItems, setInProgressItems] = useState([]);
    const [hasObstacle, setHasObstacle] = useState(false);
    const [obstacleItems, setObstacleItems] = useState([
        { title: '', obstacleNote: '', actionPlan: '', categoryTag: userDivision || 'UMUM', photos: [] }
    ]);
    const [tomorrowPlans, setTomorrowPlans] = useState([
        { title: '', categoryTag: userDivision || 'UMUM', priority: 'SEDANG' }
    ]);

    // Legacy States for backward compatibility
    const [morningPoints, setMorningPoints] = useState([{ text: '', categoryTag: userDivision || 'UMUM', status: 'COMPLETED', obstacleNote: '', photos: [] }]);
    const [afternoonPoints, setAfternoonPoints] = useState([{ text: '', categoryTag: userDivision || 'UMUM', status: 'COMPLETED', obstacleNote: '', photos: [] }]);
    const [personalStats, setPersonalStats] = useState(null);
    const [uploadingPhotoIndex, setUploadingPhotoIndex] = useState(null);
    const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
    const [hasCarriedOver, setHasCarriedOver] = useState(false);
    const [userProjects, setUserProjects] = useState([]);
    const [userWeeklyPlans, setUserWeeklyPlans] = useState([]);
    const [showTemplateAccordion, setShowTemplateAccordion] = useState(false);
    const [showAllTemplates, setShowAllTemplates] = useState(false);
    const [showMissedDates, setShowMissedDates] = useState(false);
    const [mobileSessionTab, setMobileSessionTab] = useState('ALL');
    const [cameraModalConfig, setCameraModalConfig] = useState({ isOpen: false, index: null, period: 'completed' });
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

    // Plans / Perencanaan Kerja
    const [plans, setPlans] = useState([]);
    const [loadingPlans, setLoadingPlans] = useState(false);

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
            fetchPlans();
        } else if (activeTab === 'matrix' && isKabid) {
            fetchMatrixData();
        } else if (activeTab === 'weekly-pdf' && isKabid) {
            fetchWeeklySummary();
        } else if (activeTab === 'penugasan') {
            fetchAssignments();
            if (isKabid) fetchStaffList();
        } else if (activeTab === 'perencanaan') {
            fetchPlans();
            if (isKabid) fetchStaffList();
        } else if (activeTab === 'hafalan') {
            if (isKabid) fetchStaffList();
        } else if (activeTab === 'pelatihan') {
            fetchStaffList();
        }
    }, [activeTab, selectedDate, matrixMonth, weeklyStartDate, weeklyEndDate]);

    // Fetch reports feed whenever filters/dates change in monitoring tab
    useEffect(() => {
        if (activeTab === 'monitoring' && isKabid) {
            fetchReportsFeed();
        }
    }, [monitoringStartDate, monitoringEndDate, selectedStaffId, filterCategory, filterStatus]);

    // Auto-Save Draft to LocalStorage (Metode PPP)
    useEffect(() => {
        if (activeTab === 'laporan' && !loading && currentLoadedDateRef.current === selectedDate) {
            const hasContent = completedItems.some(p => p.title?.trim() || p.photos?.length > 0) ||
                inProgressItems.some(p => p.title?.trim() || p.photos?.length > 0) ||
                (hasObstacle && obstacleItems.some(o => o.obstacleNote?.trim() || o.title?.trim())) ||
                tomorrowPlans.some(t => t.title?.trim());

            if (hasContent) {
                const draftKey = `draft_laporan_ppp_${user.id || 'default'}_${selectedDate}`;
                localStorage.setItem(draftKey, JSON.stringify({
                    completedItems,
                    inProgressItems,
                    hasObstacle,
                    obstacleItems,
                    tomorrowPlans
                }));
            }
        }
    }, [completedItems, inProgressItems, hasObstacle, obstacleItems, tomorrowPlans, selectedDate, activeTab, loading, user.id]);

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
    // API CALLS: STAFF (Metode PPP: Progress, Problems, Plans)
    // -------------------------------------------------------------
    const fetchMyReport = async () => {
        try {
            setLoading(true);
            const targetDateToLoad = typeof selectedDate === 'string' 
                ? selectedDate 
                : (selectedDate?.date || dayjs().format('YYYY-MM-DD'));
            const res = await api.get('/laporan', {
                params: { date: targetDateToLoad }
            });
            if (res.data.success) {
                if (res.data.userProjects) setUserProjects(res.data.userProjects);
                if (res.data.userWeeklyPlans) setUserWeeklyPlans(res.data.userWeeklyPlans);

                const rep = res.data.myReport;
                const meta = rep?.metadata || {};
                const hasPppData = (Array.isArray(meta.completedItems) && meta.completedItems.length > 0) ||
                                   (Array.isArray(meta.inProgressItems) && meta.inProgressItems.length > 0) ||
                                   (Array.isArray(meta.obstacleItems) && meta.obstacleItems.length > 0) ||
                                   (Array.isArray(meta.tomorrowPlans) && meta.tomorrowPlans.length > 0);

                if (hasPppData) {
                    setCompletedItems(meta.completedItems?.length ? meta.completedItems : [{ title: '', output: '', categoryTag: userDivision || 'UMUM', photos: [] }]);
                    setInProgressItems(meta.inProgressItems || []);
                    const obs = meta.obstacleItems || [];
                    setObstacleItems(obs.length > 0 ? obs : [{ title: '', obstacleNote: '', actionPlan: '', categoryTag: userDivision || 'UMUM', photos: [] }]);
                    setHasObstacle(obs.length > 0);
                    setTomorrowPlans(meta.tomorrowPlans?.length ? meta.tomorrowPlans : [{ title: '', categoryTag: userDivision || 'UMUM', priority: 'SEDANG' }]);

                    // Backward-compat for legacy components
                    const pts = meta.manualPoints;
                    if (pts) {
                        setMorningPoints(pts.morning || []);
                        setAfternoonPoints(pts.afternoon || []);
                    }
                    setHasRestoredDraft(false);
                    setHasCarriedOver(false);
                    currentLoadedDateRef.current = targetDateToLoad;
                } else if (rep?.metadata?.manualPoints) {
                    // Legacy report conversion to PPP
                    const pts = rep.metadata.manualPoints;
                    const m = pts.morning || pts.morningPoints || [];
                    const a = pts.afternoon || pts.afternoonPoints || [];
                    const all = [...m, ...a];
                    
                    const completed = all.filter(p => p.status === 'COMPLETED');
                    const inProg = all.filter(p => p.status === 'IN_PROGRESS');
                    const obst = all.filter(p => p.status === 'OBSTACLE');

                    setCompletedItems(completed.length > 0 ? completed.map(p => ({
                        title: p.text || '',
                        output: p.output || 'Tuntas dilaksanakan sesuai target jadwal.',
                        categoryTag: p.categoryTag || userDivision || 'UMUM',
                        photos: p.photos || [],
                        sourceType: p.sourceType || null,
                        sourceId: p.sourceId || null,
                        planItemIndex: p.planItemIndex !== undefined ? p.planItemIndex : null,
                        projectId: p.projectId || null,
                        projectItemIndex: p.projectItemIndex !== undefined ? p.projectItemIndex : null,
                        isRoutine: !!p.isRoutine
                    })) : [{ title: '', output: '', categoryTag: userDivision || 'UMUM', photos: [] }]);

                    setInProgressItems(inProg.map(p => ({
                        title: p.text || '',
                        progressPercentage: p.progressPercentage || 50,
                        targetDate: p.targetDate || '',
                        categoryTag: p.categoryTag || userDivision || 'UMUM',
                        photos: p.photos || [],
                        sourceType: p.sourceType || null,
                        sourceId: p.sourceId || null,
                        planItemIndex: p.planItemIndex !== undefined ? p.planItemIndex : null,
                        projectId: p.projectId || null,
                        projectItemIndex: p.projectItemIndex !== undefined ? p.projectItemIndex : null
                    })));

                    setObstacleItems(obst.length > 0 ? obst.map(p => ({
                        title: p.text || 'Kendala Lapangan',
                        obstacleNote: p.obstacleNote || '',
                        actionPlan: p.actionPlan || '',
                        categoryTag: p.categoryTag || userDivision || 'UMUM',
                        photos: p.photos || []
                    })) : [{ title: '', obstacleNote: '', actionPlan: '', categoryTag: userDivision || 'UMUM', photos: [] }]);
                    setHasObstacle(obst.length > 0);

                    const tp = Array.isArray(rep.metadata?.tomorrowPlans) ? rep.metadata.tomorrowPlans : [];
                    setTomorrowPlans(tp.length > 0 ? tp : [{ title: '', categoryTag: userDivision || 'UMUM', priority: 'SEDANG' }]);

                    setMorningPoints(m);
                    setAfternoonPoints(a);
                    setHasRestoredDraft(false);
                    setHasCarriedOver(false);
                    currentLoadedDateRef.current = targetDateToLoad;
                } else {
                    // Check local draft first
                    const draftKey = `draft_laporan_ppp_${user.id || 'default'}_${targetDateToLoad}`;
                    const savedDraft = localStorage.getItem(draftKey);
                    if (savedDraft) {
                        try {
                            const parsed = JSON.parse(savedDraft);
                            if (parsed.completedItems || parsed.inProgressItems || parsed.tomorrowPlans) {
                                setCompletedItems(parsed.completedItems || [{ title: '', output: '', categoryTag: userDivision || 'UMUM', photos: [] }]);
                                setInProgressItems(parsed.inProgressItems || []);
                                setHasObstacle(!!parsed.hasObstacle);
                                setObstacleItems(parsed.obstacleItems || [{ title: '', obstacleNote: '', actionPlan: '', categoryTag: userDivision || 'UMUM', photos: [] }]);
                                setTomorrowPlans(parsed.tomorrowPlans || [{ title: '', categoryTag: userDivision || 'UMUM', priority: 'SEDANG' }]);
                                setHasRestoredDraft(true);
                                setHasCarriedOver(false);
                                currentLoadedDateRef.current = targetDateToLoad;
                                return;
                            }
                        } catch (e) {
                            console.error('Failed to parse draft PPP', e);
                        }
                    }

                    // Auto Carry-Over dari Laporan Rencana Kemarin (suggestedFromYesterday)
                    if (Array.isArray(res.data.suggestedFromYesterday) && res.data.suggestedFromYesterday.length > 0) {
                        setCompletedItems([{ title: '', output: '', categoryTag: userDivision || 'UMUM', photos: [] }]);
                        setInProgressItems(res.data.suggestedFromYesterday.map(item => ({
                            title: item.text || item.title || '',
                            progressPercentage: item.progressPercentage || 50,
                            targetDate: 'Hari ini',
                            categoryTag: item.categoryTag || userDivision || 'UMUM',
                            photos: [],
                            sourceType: item.sourceType || 'PLAN',
                            sourceId: item.sourceId || null,
                            planItemIndex: item.planItemIndex !== undefined ? item.planItemIndex : null,
                            isFromYesterday: true
                        })));
                        setHasObstacle(false);
                        setObstacleItems([{ title: '', obstacleNote: '', actionPlan: '', categoryTag: userDivision || 'UMUM', photos: [] }]);
                        setTomorrowPlans([{ title: '', categoryTag: userDivision || 'UMUM', priority: 'SEDANG' }]);
                        setHasCarriedOver(true);
                    } else {
                        setCompletedItems([{ title: '', output: '', categoryTag: userDivision || 'UMUM', photos: [] }]);
                        setInProgressItems([]);
                        setHasObstacle(false);
                        setObstacleItems([{ title: '', obstacleNote: '', actionPlan: '', categoryTag: userDivision || 'UMUM', photos: [] }]);
                        setTomorrowPlans([{ title: '', categoryTag: userDivision || 'UMUM', priority: 'SEDANG' }]);
                        setHasCarriedOver(false);
                    }
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

    const handleSaveReport = async () => {
        try {
            const validCompleted = completedItems.filter(p => (p.title && p.title.trim()) || (p.photos && p.photos.length > 0));
            const validInProgress = inProgressItems.filter(p => (p.title && p.title.trim()) || (p.photos && p.photos.length > 0));
            const validObstacles = hasObstacle ? obstacleItems.filter(o => (o.title && o.title.trim()) || (o.obstacleNote && o.obstacleNote.trim())) : [];
            const validTomorrow = tomorrowPlans.filter(t => t.title && t.title.trim());

            if (validCompleted.length === 0 && validInProgress.length === 0 && validObstacles.length === 0) {
                alert('Mohon isi minimal satu butir pekerjaan hari ini (Pekerjaan Selesai, Dalam Proses, atau Kendala).');
                return;
            }

            if (validTomorrow.length === 0) {
                alert('⚠️ KEWAJIBAN STAF:\nMohon isi minimal 1 butir pada bagian "D. Rencana Kerja Besok" agar tugas Anda terencana dan otomatis menjadi acuan kerja pada hari berikutnya.');
                return;
            }

            setSaving(true);

            // Petakan ke manualPoints agar sistem lama (PDF, Monitoring, AI, Export) tetap 100% kompatibel
            const morningPoints = [
                ...validCompleted.map(c => ({
                    text: c.title,
                    output: c.output || '',
                    categoryTag: c.categoryTag || userDivision || 'UMUM',
                    status: 'COMPLETED',
                    progressPercentage: 100,
                    photos: c.photos || [],
                    sourceType: c.sourceType,
                    sourceId: c.sourceId,
                    planItemIndex: c.planItemIndex,
                    projectId: c.projectId,
                    projectItemIndex: c.projectItemIndex,
                    isRoutine: !!c.isRoutine
                })),
                ...validObstacles.map(o => ({
                    text: o.title || 'Kendala Lapangan',
                    categoryTag: o.categoryTag || userDivision || 'UMUM',
                    status: 'OBSTACLE',
                    obstacleNote: o.obstacleNote || '',
                    actionPlan: o.actionPlan || '',
                    photos: o.photos || []
                }))
            ];

            const afternoonPoints = validInProgress.map(p => ({
                text: p.title,
                categoryTag: p.categoryTag || userDivision || 'UMUM',
                status: 'IN_PROGRESS',
                progressPercentage: p.progressPercentage || 50,
                targetDate: p.targetDate || '',
                photos: p.photos || [],
                sourceType: p.sourceType,
                sourceId: p.sourceId,
                planItemIndex: p.planItemIndex,
                projectId: p.projectId,
                projectItemIndex: p.projectItemIndex
            }));

            const res = await api.post('/laporan/my', {
                targetDate: selectedDate,
                category: userDivision || 'UMUM',
                completedItems: validCompleted,
                inProgressItems: validInProgress,
                obstacleItems: validObstacles,
                tomorrowPlans: validTomorrow,
                manualPoints: {
                    morning: morningPoints.length > 0 ? morningPoints : [{ text: 'Pekerjaan Selesai', status: 'COMPLETED' }],
                    afternoon: afternoonPoints
                }
            });

            if (res.data.success) {
                localStorage.removeItem(`draft_laporan_ppp_${user.id || 'default'}_${selectedDate}`);
                localStorage.removeItem(`draft_laporan_${user.id || 'default'}_${selectedDate}`);
                setHasRestoredDraft(false);

                const isOldDate = selectedDate !== dayjs().format('YYYY-MM-DD');
                const formattedDate = dayjs(selectedDate).format('DD/MM/YYYY');

                alert(isOldDate
                    ? `Alhamdulillah, laporan PPP susulan untuk tanggal ${formattedDate} (WIB) berhasil disimpan!`
                    : `Alhamdulillah, laporan harian PPP & rencana kerja besok berhasil disimpan!`
                );
                await Promise.all([fetchMyReport(), fetchMyStats(), fetchPlans()]);
            }
        } catch (error) {
            console.error('Error saving report:', error);
            const errMsg = error.response?.data?.error || 'Gagal menyimpan laporan. Silakan periksa koneksi dan coba lagi.';
            alert(errMsg);
        } finally {
            setSaving(false);
        }
    };

    const handlePhotoUpload = async (index, fileOrDataUrl, section = 'completed') => {
        if (!fileOrDataUrl) return;
        try {
            setUploadingPhotoIndex(`${section}-${index}`);
            const compressedBase64 = await compressImage(fileOrDataUrl);
            const res = await api.post('/laporan/upload-photo', { base64: compressedBase64 });
            const photoUrl = res.data.url || compressedBase64;

            const photoObj = {
                url: photoUrl,
                timestamp: new Date().toISOString()
            };

            if (section === 'completed' || section === 'morning') {
                const updated = [...completedItems];
                if ((updated[index].photos || []).length >= 5) return alert('Maksimal 5 foto per butir pekerjaan!');
                updated[index].photos = [...(updated[index].photos || []), photoObj];
                setCompletedItems(updated);
            } else if (section === 'inprogress' || section === 'afternoon') {
                const updated = [...inProgressItems];
                if ((updated[index].photos || []).length >= 5) return alert('Maksimal 5 foto per butir pekerjaan!');
                updated[index].photos = [...(updated[index].photos || []), photoObj];
                setInProgressItems(updated);
            } else if (section === 'obstacle') {
                const updated = [...obstacleItems];
                if ((updated[index].photos || []).length >= 5) return alert('Maksimal 5 foto per kendala!');
                updated[index].photos = [...(updated[index].photos || []), photoObj];
                setObstacleItems(updated);
            }
        } catch (err) {
            console.error('Photo upload error:', err);
            alert(err.message || 'Gagal mengunggah foto.');
        } finally {
            setUploadingPhotoIndex(null);
        }
    };

    const handleRemovePhoto = (pointIndex, photoIndex, section = 'completed') => {
        if (section === 'completed' || section === 'morning') {
            const updated = [...completedItems];
            updated[pointIndex].photos = (updated[pointIndex].photos || []).filter((_, i) => i !== photoIndex);
            setCompletedItems(updated);
        } else if (section === 'inprogress' || section === 'afternoon') {
            const updated = [...inProgressItems];
            updated[pointIndex].photos = (updated[pointIndex].photos || []).filter((_, i) => i !== photoIndex);
            setInProgressItems(updated);
        } else if (section === 'obstacle') {
            const updated = [...obstacleItems];
            updated[pointIndex].photos = (updated[pointIndex].photos || []).filter((_, i) => i !== photoIndex);
            setObstacleItems(updated);
        }
    };

    const applyRoutine = (routineText, categoryKey, targetPillar = 'COMPLETED') => {
        const cat = categoryKey || userDivision || 'UMUM';
        if (targetPillar === 'COMPLETED') {
            setCompletedItems(prev => {
                const isClean = prev.length === 1 && !prev[0].title.trim() && (!prev[0].photos || prev[0].photos.length === 0);
                const newItem = {
                    title: routineText,
                    output: 'Tuntas dilaksanakan sesuai SOP.',
                    categoryTag: cat,
                    isRoutine: true,
                    photos: []
                };
                return isClean ? [newItem] : [...prev, newItem];
            });
        } else if (targetPillar === 'IN_PROGRESS') {
            setInProgressItems(prev => [
                ...prev,
                {
                    title: routineText,
                    progressPercentage: 50,
                    targetDate: 'Hari ini',
                    categoryTag: cat,
                    isRoutine: true,
                    photos: []
                }
            ]);
        } else if (targetPillar === 'TOMORROW') {
            setTomorrowPlans(prev => {
                const isClean = prev.length === 1 && !prev[0].title.trim();
                const newItem = {
                    title: routineText,
                    categoryTag: cat,
                    priority: 'SEDANG'
                };
                return isClean ? [newItem] : [...prev, newItem];
            });
        }
    };

    const convertTaskToReport = (task, targetPillar = 'COMPLETED') => {
        const cat = task.category || userDivision || 'UMUM';
        const taskTitle = `[Penugasan: ${task.title}] ${task.description || ''}`.trim();
        const isDone = task.progressPercentage === 100 || targetPillar === 'COMPLETED';

        if (targetPillar === 'TOMORROW') {
            setTomorrowPlans(prev => {
                const isClean = prev.length === 1 && !prev[0].title.trim();
                const newItem = {
                    title: `Menyelesaikan penugasan: ${task.title}`,
                    categoryTag: cat,
                    priority: task.priority || 'TINGGI',
                    sourceType: 'ASSIGNMENT',
                    sourceId: task.id
                };
                return isClean ? [newItem] : [...prev, newItem];
            });
        } else if (isDone && targetPillar !== 'IN_PROGRESS') {
            setCompletedItems(prev => {
                const isClean = prev.length === 1 && !prev[0].title.trim() && (!prev[0].photos || prev[0].photos.length === 0);
                const newItem = {
                    title: taskTitle,
                    output: task.targetOutput || 'Tugas selesai dilaksanakan 100%.',
                    categoryTag: cat,
                    sourceType: 'ASSIGNMENT',
                    sourceId: task.id,
                    photos: []
                };
                return isClean ? [newItem] : [...prev, newItem];
            });
        } else {
            setInProgressItems(prev => [
                ...prev,
                {
                    title: taskTitle,
                    progressPercentage: task.progressPercentage || 50,
                    targetDate: task.dueDate ? dayjs(task.dueDate).format('YYYY-MM-DD') : 'Hari ini',
                    categoryTag: cat,
                    sourceType: 'ASSIGNMENT',
                    sourceId: task.id,
                    photos: []
                }
            ]);
        }
        setActiveTab('laporan');
    };

    const convertPlanItemToReport = (plan, item, itemIndex, targetPillar = 'COMPLETED', extraPhotos = []) => {
        const itemText = item ? (item.activity || item.text || '') : '';
        const rawTitle = (plan.metadata?.title || plan.content || 'Kegiatan').trim();
        const cleanTitle = rawTitle.replace(/^\[?rencana\s*(kerja)?[^\]:]*\]?[:\s]*/i, '').trim() || rawTitle;
        const isSingleGoal = !item;

        const isDone = isSingleGoal
            ? (plan.metadata?.status === 'SELESAI' || plan.metadata?.percentage === 100)
            : (item?.percentage === 100 || item?.status === 'SELESAI');

        let resolvedPhotos = [];
        if (Array.isArray(extraPhotos) && extraPhotos.length > 0) {
            resolvedPhotos = extraPhotos;
        } else if (item?.photos && Array.isArray(item.photos) && item.photos.length > 0) {
            resolvedPhotos = item.photos;
        } else if (item?.photo) {
            resolvedPhotos = [{ url: item.photo, timestamp: new Date().toISOString() }];
        } else if (isSingleGoal && plan.metadata?.photos && Array.isArray(plan.metadata.photos)) {
            resolvedPhotos = plan.metadata.photos;
        }

        const pct = isDone ? 100 : (isSingleGoal ? (plan.metadata?.percentage || 50) : (item?.percentage !== undefined ? item.percentage : 50));
        const cleanItemText = itemText.trim();
        const formattedTitle = cleanItemText ? `${cleanTitle} : ${cleanItemText}` : cleanTitle;
        const isProject = !!plan.metadata?.isProject || plan.metadata?.planType === 'PROJECT';
        const cat = plan.metadata?.categoryTag || plan.category || userDivision || 'UMUM';

        if (targetPillar === 'TOMORROW') {
            setTomorrowPlans(prev => {
                const isClean = prev.length === 1 && !prev[0].title.trim();
                const newItem = {
                    title: formattedTitle,
                    categoryTag: cat,
                    priority: plan.metadata?.priority || 'SEDANG',
                    sourceType: isProject ? 'PROJECT' : 'PLAN',
                    sourceId: plan.id,
                    planItemIndex: isSingleGoal ? null : itemIndex
                };
                return isClean ? [newItem] : [...prev, newItem];
            });
        } else if (targetPillar === 'IN_PROGRESS' || (!isDone && targetPillar !== 'COMPLETED')) {
            setInProgressItems(prev => [
                ...prev,
                {
                    title: formattedTitle,
                    progressPercentage: pct,
                    targetDate: item?.targetDate || 'Hari kerja berikutnya',
                    categoryTag: cat,
                    sourceType: isProject ? 'PROJECT' : 'PLAN',
                    sourceId: plan.id,
                    planItemIndex: isSingleGoal ? null : itemIndex,
                    projectId: item?.projectId || (isProject ? plan.id : null),
                    projectItemIndex: item?.projectItemIndex !== undefined ? item.projectItemIndex : (isProject ? itemIndex : null),
                    photos: resolvedPhotos
                }
            ]);
        } else {
            setCompletedItems(prev => {
                const isClean = prev.length === 1 && !prev[0].title.trim() && (!prev[0].photos || prev[0].photos.length === 0);
                const newItem = {
                    title: formattedTitle,
                    output: plan.metadata?.targetOutput || 'Tuntas dilaksanakan sesuai target jadwal.',
                    categoryTag: cat,
                    sourceType: isProject ? 'PROJECT' : 'PLAN',
                    sourceId: plan.id,
                    planItemIndex: isSingleGoal ? null : itemIndex,
                    projectId: item?.projectId || (isProject ? plan.id : null),
                    projectItemIndex: item?.projectItemIndex !== undefined ? item.projectItemIndex : (isProject ? itemIndex : null),
                    photos: resolvedPhotos
                };
                return isClean ? [newItem] : [...prev, newItem];
            });
        }
        setActiveTab('laporan');
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

    const fetchPlans = async () => {
        try {
            setLoadingPlans(true);
            const params = {};
            if (isKabid) {
                params.limit = 'all';
            } else {
                params.userId = user.id;
            }
            const res = await api.get('/personnel/reports', { params });
            const data = res.data?.data || res.data || [];
            const planList = Array.isArray(data) ? data.filter(r => r.metadata?.isPlan) : [];
            setPlans(planList);
        } catch (err) {
            console.error('Error fetching plans:', err);
        } finally {
            setLoadingPlans(false);
        }
    };

    const handleCreateOrUpdatePlan = async (formData) => {
        try {
            setSaving(true);
            const userPos = user.position || '';
            const validCategories = ['KEUANGAN', 'ASET', 'GUDANG', 'KENDARAAN', 'UMUM', 'TEKNISI'];
            const resolvedCat = validCategories.includes(formData.category) ? formData.category : 'UMUM';

            const isPrj = !!formData.isProject || formData.planType === 'PROJECT';
            const resolvedPlanType = isPrj ? 'PROJECT' : 'WEEKLY';

            const payload = {
                type: 'WEEKLY',
                category: resolvedCat,
                content: formData.notes || '',
                date: formData.startDate || dayjs().format('YYYY-MM-DD'),
                metadata: {
                    isPlan: true,
                    isProject: isPrj,
                    planType: resolvedPlanType,
                    projectId: formData.projectId || null,
                    title: formData.title,
                    position: formData.position || userPos,
                    categoryTag: formData.category || userDivision || 'UMUM',
                    priority: formData.priority || 'SEDANG',
                    startDate: formData.startDate || dayjs().format('YYYY-MM-DD'),
                    endDate: formData.endDate,
                    status: formData.status || 'PENDING',
                    percentage: formData.percentage !== undefined ? formData.percentage : 0,
                    items: Array.isArray(formData.items) ? formData.items.map(it => ({
                        activity: it.activity,
                        targetDate: it.targetDate || '',
                        status: it.status || 'PENDING',
                        percentage: it.percentage !== undefined ? it.percentage : 0,
                        projectId: it.projectId || formData.projectId || null,
                        projectItemIndex: it.projectItemIndex !== undefined ? it.projectItemIndex : null,
                        isFromProject: !!it.isFromProject
                    })) : []
                }
            };

            if (formData.id) {
                await api.put(`/personnel/reports/${formData.id}`, payload);
            } else {
                await api.post('/personnel/reports', payload);
            }
            await fetchPlans();
            if (typeof fetchMyReport === 'function') {
                fetchMyReport();
            }
            return true;
        } catch (err) {
            console.error('Error saving plan:', err);
            alert(err.response?.data?.error || 'Gagal menyimpan rencana kerja.');
            return false;
        } finally {
            setSaving(false);
        }
    };

    const handleTogglePlanStatus = async (plan, extraMeta = {}) => {
        try {
            const meta = plan.metadata || {};
            const isCurrentlyDone = meta.status === 'SELESAI' || meta.percentage === 100;
            const newStatus = extraMeta.status || (isCurrentlyDone ? 'PENDING' : 'SELESAI');
            const newPercentage = extraMeta.percentage !== undefined ? extraMeta.percentage : (isCurrentlyDone ? 0 : 100);

            const updatedItems = Array.isArray(meta.items)
                ? meta.items.map(it => ({
                    ...it,
                    status: newStatus,
                    percentage: newPercentage
                }))
                : [];

            await api.put(`/personnel/reports/${plan.id}`, {
                type: plan.type,
                category: plan.category,
                content: plan.content,
                date: plan.date,
                metadata: {
                    ...meta,
                    ...extraMeta,
                    status: newStatus,
                    percentage: newPercentage,
                    ...(updatedItems.length > 0 ? { items: updatedItems } : {})
                }
            });
            await fetchPlans();
            if (typeof fetchMyReport === 'function') {
                fetchMyReport();
            }
        } catch (err) {
            console.error('Error toggling plan status:', err);
            alert('Gagal memperbarui status rencana kerja.');
        }
    };

    const handleUpdatePlanItem = async (plan, itemIdx, updates) => {
        try {
            const updatedItems = [...(plan.metadata?.items || [])];
            updatedItems[itemIdx] = { ...updatedItems[itemIdx], ...updates };
            if (updates.percentage === 100) updatedItems[itemIdx].status = 'SELESAI';
            else if (updates.percentage === 0) updatedItems[itemIdx].status = 'PENDING';
            else if (updates.percentage > 0 && updates.percentage < 100 && !updates.status) updatedItems[itemIdx].status = 'PROSES';

            // Recalculate whole plan percentage & status
            const allItemsDone = updatedItems.every(it => it.percentage === 100 || it.status === 'SELESAI');
            const avg = Math.round(updatedItems.reduce((acc, curr) => acc + (curr.percentage || 0), 0) / updatedItems.length);
            const overallStatus = (allItemsDone || avg === 100) ? 'SELESAI' : (avg > 0 ? 'PROSES' : 'PENDING');

            await api.put(`/personnel/reports/${plan.id}`, {
                type: plan.type,
                category: plan.category,
                content: plan.content,
                date: plan.date,
                metadata: {
                    ...plan.metadata,
                    percentage: avg,
                    status: overallStatus,
                    items: updatedItems
                }
            });
            await fetchPlans();
            if (typeof fetchMyReport === 'function') {
                fetchMyReport();
            }
        } catch (err) {
            console.error('Error updating plan item:', err);
            alert('Gagal memperbarui butir rencana kerja.');
        }
    };

    const handleDeletePlan = async (planId) => {
        try {
            await api.delete(`/personnel/reports/${planId}`);
            await fetchPlans();
            if (typeof fetchMyReport === 'function') {
                fetchMyReport();
            }
        } catch (err) {
            console.error('Error deleting plan:', err);
            alert(err.response?.data?.error || 'Gagal menghapus rencana kerja.');
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
        <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500 pb-44 sm:pb-16 print:p-0 print:m-0 print:space-y-0 print:animate-none">
            {/* TOP HEADER */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 sm:gap-4 bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm print:hidden no-print">
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
                                className={`px-2.5 py-1 rounded-xl text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer ${selectedDate === dayjs().format('YYYY-MM-DD') ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200/60'
                                    }`}
                            >
                                Hari Ini
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedDate(dayjs().subtract(1, 'day').format('YYYY-MM-DD'))}
                                className={`px-2.5 py-1 rounded-xl text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer ${selectedDate === dayjs().subtract(1, 'day').format('YYYY-MM-DD') ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200/60'
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
                            else if (activeTab === 'laporan') { fetchMyReport(); fetchMyStats(); fetchPlans(); }
                            else if (activeTab === 'matrix') fetchMatrixData();
                            else if (activeTab === 'weekly-pdf') fetchWeeklySummary();
                            else if (activeTab === 'perencanaan') fetchPlans();
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

            {/* TAB NAVIGATION - Sticky & Responsive Wrap */}
            <div className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-md -mx-4 px-4 sm:mx-0 sm:px-0 py-2.5 sm:py-3 flex flex-wrap items-center gap-2 sm:gap-2.5 border-b border-slate-200/90 print:hidden no-print">
                {isKabid ? (
                    <>
                        <button
                            onClick={() => setActiveTab('dashboard')}
                            className={`px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 whitespace-nowrap cursor-pointer shadow-xs ${
                                activeTab === 'dashboard'
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-600/20'
                                    : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100/90 border border-slate-200'
                            }`}
                        >
                            <TrendingUp size={16} /> Executive Dashboard
                        </button>
                        <button
                            onClick={() => setActiveTab('laporan')}
                            className={`px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 whitespace-nowrap cursor-pointer shadow-xs ${
                                activeTab === 'laporan'
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-600/20'
                                    : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100/90 border border-slate-200'
                            }`}
                        >
                            <FileText size={16} /> Isi Laporan Harian
                        </button>
                        <button
                            onClick={() => setActiveTab('monitoring')}
                            className={`px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 whitespace-nowrap cursor-pointer shadow-xs ${
                                activeTab === 'monitoring'
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-600/20'
                                    : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100/90 border border-slate-200'
                            }`}
                        >
                            <Eye size={16} /> Monitoring Feed Tim
                        </button>
                        <button
                            onClick={() => setActiveTab('matrix')}
                            className={`px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 whitespace-nowrap cursor-pointer shadow-xs ${
                                activeTab === 'matrix'
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-600/20'
                                    : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100/90 border border-slate-200'
                            }`}
                        >
                            <Calendar size={16} /> Matriks Kedisiplinan
                        </button>
                        {isOnlyKabidSarana && (
                            <button
                                onClick={() => setActiveTab('weekly-pdf')}
                                className={`px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 whitespace-nowrap cursor-pointer shadow-xs ${
                                    activeTab === 'weekly-pdf'
                                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25 ring-2 ring-indigo-600/20'
                                        : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100/90 border border-slate-200'
                                }`}
                            >
                                <Printer size={16} /> Laporan Mingguan Kabid (PDF)
                            </button>
                        )}
                        <button
                            onClick={() => setActiveTab('penugasan')}
                            className={`px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 whitespace-nowrap cursor-pointer shadow-xs ${
                                activeTab === 'penugasan'
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-600/20'
                                    : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100/90 border border-slate-200'
                            }`}
                        >
                            <CheckSquare size={16} /> Delegasi Penugasan
                        </button>
                        <button
                            onClick={() => setActiveTab('perencanaan')}
                            className={`px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 whitespace-nowrap cursor-pointer shadow-xs ${
                                activeTab === 'perencanaan'
                                    ? 'bg-violet-600 text-white shadow-md shadow-violet-500/25 ring-2 ring-violet-600/20'
                                    : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100/90 border border-slate-200'
                            }`}
                        >
                            <Target size={16} /> Perencanaan Kerja
                        </button>
                        <button
                            onClick={() => setActiveTab('hafalan')}
                            className={`px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 whitespace-nowrap cursor-pointer shadow-xs ${
                                activeTab === 'hafalan'
                                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/25 ring-2 ring-emerald-600/20'
                                    : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100/90 border border-slate-200'
                            }`}
                        >
                            <BookOpen size={16} /> Setoran Hafalan
                        </button>
                        <button
                            onClick={() => setActiveTab('pelatihan')}
                            className={`px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 whitespace-nowrap cursor-pointer shadow-xs ${
                                activeTab === 'pelatihan'
                                    ? 'bg-amber-600 text-white shadow-md shadow-amber-500/25 ring-2 ring-amber-600/20'
                                    : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100/90 border border-slate-200'
                            }`}
                        >
                            <GraduationCap size={16} /> Pelatihan Karyawan
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            onClick={() => setActiveTab('laporan')}
                            className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 whitespace-nowrap cursor-pointer shadow-xs ${
                                activeTab === 'laporan'
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-600/20'
                                    : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100/90 border border-slate-200'
                            }`}
                        >
                            <FileText size={16} /> Laporan Harian Saya
                        </button>
                        <button
                            onClick={() => setActiveTab('penugasan')}
                            className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 whitespace-nowrap cursor-pointer shadow-xs ${
                                activeTab === 'penugasan'
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-600/20'
                                    : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100/90 border border-slate-200'
                            }`}
                        >
                            <CheckSquare size={16} /> Penugasan Saya
                        </button>
                        <button
                            onClick={() => setActiveTab('perencanaan')}
                            className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 whitespace-nowrap cursor-pointer shadow-xs ${
                                activeTab === 'perencanaan'
                                    ? 'bg-violet-600 text-white shadow-md shadow-violet-500/25 ring-2 ring-violet-600/20'
                                    : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100/90 border border-slate-200'
                            }`}
                        >
                            <Target size={16} /> Perencanaan Kerja
                        </button>
                        <button
                            onClick={() => setActiveTab('hafalan')}
                            className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 whitespace-nowrap cursor-pointer shadow-xs ${
                                activeTab === 'hafalan'
                                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/25 ring-2 ring-emerald-600/20'
                                    : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100/90 border border-slate-200'
                            }`}
                        >
                            <BookOpen size={16} /> Setoran Hafalan
                        </button>
                        <button
                            onClick={() => setActiveTab('pelatihan')}
                            className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 whitespace-nowrap cursor-pointer shadow-xs ${
                                activeTab === 'pelatihan'
                                    ? 'bg-amber-600 text-white shadow-md shadow-amber-500/25 ring-2 ring-amber-600/20'
                                    : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100/90 border border-slate-200'
                            }`}
                        >
                            <GraduationCap size={16} /> Pelatihan Karyawan
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

            {/* CARRIED OVER FROM YESTERDAY BANNER */}
            {hasCarriedOver && activeTab === 'laporan' && (
                <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl text-xs text-emerald-800 flex items-center justify-between animate-in fade-in">
                    <div className="flex items-center gap-2 font-bold">
                        <Sparkles size={16} className="text-emerald-600 shrink-0" />
                        <span>⚡ Butir rencana dari laporan kemarin sore otomatis dimuat ke agenda kerja hari ini (status: ⏳ Dalam Proses).</span>
                    </div>
                    <button
                        onClick={() => setHasCarriedOver(false)}
                        className="text-emerald-600 hover:text-emerald-800 text-xs font-bold shrink-0 ml-2 cursor-pointer"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* FRIDAY WEEKLY PLAN AGENDA BANNER */}
            {[5, 6, 0].includes(dayjs().day()) && (
                <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
                            <Calendar className="text-white" size={20} />
                        </div>
                        <div>
                            <h4 className="text-sm font-black tracking-wide flex items-center gap-1.5">
                                📢 Agenda Hari Jumat: Susun Rencana Kerja Pekan Depan
                            </h4>
                            <p className="text-xs text-blue-100">
                                Sebelum mengakhiri pekan kerja, susun Rencana Kerja untuk periode {dayjs().add(1, 'week').startOf('isoWeek').format('DD MMM')} - {dayjs().add(1, 'week').startOf('isoWeek').add(4, 'day').format('DD MMM YYYY')}. Anda dapat menarik butir dari Project yang aktif atau kegiatan operasional lainnya.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setActiveTab('plans')}
                        className="px-4 py-2 bg-white text-blue-700 hover:bg-blue-50 font-bold rounded-xl text-xs shrink-0 transition-all shadow-xs cursor-pointer active:scale-95 text-center"
                    >
                        ➕ Susun Rencana Pekan Depan
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
                            setSelectedDate={handleSetSelectedDate}
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
                            setActiveTab={setActiveTab}
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

                    {/* TAB: LAPORAN HARIAN SAYA (METODE PPP) */}
                    {activeTab === 'laporan' && (
                        <DailyReportFormTab
                            user={user}
                            userDivision={userDivision}
                            selectedDate={selectedDate}
                            setSelectedDate={handleSetSelectedDate}
                            completedItems={completedItems}
                            setCompletedItems={setCompletedItems}
                            inProgressItems={inProgressItems}
                            setInProgressItems={setInProgressItems}
                            hasObstacle={hasObstacle}
                            setHasObstacle={setHasObstacle}
                            obstacleItems={obstacleItems}
                            setObstacleItems={setObstacleItems}
                            tomorrowPlans={tomorrowPlans}
                            setTomorrowPlans={setTomorrowPlans}
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
                            plans={plans}
                            userProjects={userProjects}
                            userWeeklyPlans={userWeeklyPlans}
                            convertPlanItemToReport={convertPlanItemToReport}
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
                    {isOnlyKabidSarana && activeTab === 'weekly-pdf' && (
                        <WeeklyPdfTab
                            weeklyData={weeklyData}
                            weeklyStartDate={weeklyStartDate}
                            setWeeklyStartDate={setWeeklyStartDate}
                            weeklyEndDate={weeklyEndDate}
                            setWeeklyEndDate={setWeeklyEndDate}
                            customKabidNiy={customKabidNiy}
                            setCustomKabidNiy={setCustomKabidNiy}
                            setLightboxPhoto={setLightboxPhoto}
                            loading={loading}
                            user={user}
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
                            onImportTaskToReport={convertTaskToReport}
                            setActiveTab={setActiveTab}
                        />
                    )}

                    {/* TAB: PERENCANAAN KERJA */}
                    {activeTab === 'perencanaan' && (
                        <WorkPlanTab
                            plans={plans}
                            userProjects={userProjects}
                            loadingPlans={loadingPlans}
                            fetchPlans={fetchPlans}
                            isKabid={isKabid}
                            user={user}
                            userDivision={userDivision}
                            staffList={staffList}
                            handleCreateOrUpdatePlan={handleCreateOrUpdatePlan}
                            handleUpdatePlanItem={handleUpdatePlanItem}
                            handleTogglePlanStatus={handleTogglePlanStatus}
                            handleDeletePlan={handleDeletePlan}
                            onImportPlanItemToReport={convertPlanItemToReport}
                            saving={saving}
                        />
                    )}

                    {/* TAB: SETORAN HAFALAN */}
                    {activeTab === 'hafalan' && (
                        <TabErrorBoundary>
                            <SetoranHafalanTab isKabid={isKabid} user={user} />
                        </TabErrorBoundary>
                    )}

                    {/* TAB: PELATIHAN KARYAWAN */}
                    {activeTab === 'pelatihan' && (
                        <TabErrorBoundary>
                            <TrainingTab
                                isKabid={isKabid}
                                user={user}
                                staffList={staffList}
                            />
                        </TabErrorBoundary>
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
