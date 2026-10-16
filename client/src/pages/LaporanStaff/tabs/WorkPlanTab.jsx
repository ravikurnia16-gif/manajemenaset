import React, { useState, useMemo, useRef } from 'react';
import { 
    Target, Calendar, CheckCircle2, Clock, Plus, Trash2, Edit3, 
    User, Sparkles, Filter, Search, ChevronDown, ChevronUp, 
    Zap, Check, RotateCcw, FileText, AlertCircle, CalendarDays,
    BarChart3, Layers, ArrowRight, CheckSquare, Square, Flame,
    ShieldAlert, Camera, Image as ImageIcon, X, Upload, Loader2,
    Eye, Download, FileSpreadsheet, Printer
} from 'lucide-react';
import dayjs from 'dayjs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import api from '../../../lib/axios';
import { getMediaUrl } from '../../../lib/media';
import LightboxModal from '../modals/LightboxModal';
import { DIVISION_TAGS } from '../constants';

const compressImageToBase64 = (fileOrBlob, maxWidth = 1200, quality = 0.82) => {
    return new Promise((resolve, reject) => {
        let objectUrl = null;
        const img = new Image();
        img.onload = () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            try {
                let width = img.naturalWidth || img.width;
                let height = img.naturalHeight || img.height;
                if (!width || !height) return reject(new Error('Dimensi foto tidak valid.'));
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
        img.onerror = () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            reject(new Error('Gagal memuat berkas gambar.'));
        };
        if (typeof fileOrBlob === 'string') {
            img.src = fileOrBlob;
        } else if (fileOrBlob instanceof Blob || fileOrBlob instanceof File) {
            objectUrl = URL.createObjectURL(fileOrBlob);
            img.src = objectUrl;
        } else {
            reject(new Error('Format berkas tidak didukung.'));
        }
    });
};

const getUserCategory = (pos = '', division = 'UMUM') => {
    const p = (pos || '').toLowerCase();
    if (p.includes('keuangan') || p.includes('administrasi')) return 'KEUANGAN';
    if (p.includes('kendaraan') || p.includes('driver') || p.includes('supir') || p.includes('transport') || p.includes('armada')) return 'KENDARAAN';
    if (p.includes('gudang') || p.includes('logistik') || p.includes('warehouse')) return 'GUDANG';
    if (p.includes('teknisi') || p.includes('maintenance') || p.includes('listrik') || p.includes('bangunan') || p.includes('ac')) return 'TEKNISI';
    if (p.includes('infrastruktur it') || p.includes('staff it') || p.includes('it') || p.includes('programming')) return 'IT';
    if (p.includes('desainer') || p.includes('desain')) return 'DESAINER';
    if (p.includes('manajemen aset') || p.includes('aset') || p.includes('inventaris') || p.includes('asset')) return 'ASET';
    return division || 'UMUM';
};

export default function WorkPlanTab({
    plans = [],
    loadingPlans = false,
    fetchPlans,
    isKabid = false,
    user = {},
    userDivision = 'UMUM',
    staffList = [],
    handleCreateOrUpdatePlan,
    handleUpdatePlanItem,
    handleTogglePlanStatus,
    handleDeletePlan,
    onImportPlanItemToReport,
    saving = false
}) {
    // Local filter and search states
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('ALL');
    const [filterStatus, setFilterStatus] = useState('ACTIVE'); // 'ALL' | 'ACTIVE' | 'DONE'
    const [filterPriority, setFilterPriority] = useState('ALL'); // 'ALL' | 'TINGGI' | 'SEDANG' | 'RENDAH'
    const [selectedStaffFilter, setSelectedStaffFilter] = useState('ALL');

    // Export Modal States
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportStartDate, setExportStartDate] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
    const [exportEndDate, setExportEndDate] = useState(dayjs().endOf('month').format('YYYY-MM-DD'));
    const [exportCategory, setExportCategory] = useState('ALL');
    const [exportPriority, setExportPriority] = useState('ALL');
    const [exportStatus, setExportStatus] = useState('ALL');
    const [exportStaffFilter, setExportStaffFilter] = useState('ALL');
    const [exportingPdf, setExportingPdf] = useState(false);

    // Filtered plans for export based on date range and selected filters
    const plansForExport = useMemo(() => {
        return plans.filter(p => {
            const meta = p.metadata || {};
            const items = meta.items || [];
            
            let isDone = false;
            if (items.length > 0) {
                const avgPct = Math.round(items.reduce((acc, curr) => acc + (curr.percentage || 0), 0) / items.length);
                isDone = avgPct === 100 || items.every(i => i.status === 'SELESAI' || i.percentage === 100);
            } else {
                isDone = meta.status === 'SELESAI' || meta.percentage === 100;
            }

            if (exportStatus === 'ACTIVE' && isDone) return false;
            if (exportStatus === 'DONE' && !isDone) return false;

            const planPriority = meta.priority || 'SEDANG';
            if (exportPriority !== 'ALL' && planPriority !== exportPriority) return false;

            if (exportCategory !== 'ALL' && p.category !== exportCategory && meta.categoryTag !== exportCategory) return false;

            if (isKabid && exportStaffFilter !== 'ALL' && p.userId !== parseInt(exportStaffFilter)) return false;

            // Date Range overlap filter
            if (exportStartDate || exportEndDate) {
                const pStart = meta.startDate ? dayjs(meta.startDate) : (p.createdAt ? dayjs(p.createdAt) : null);
                const pEnd = meta.endDate ? dayjs(meta.endDate) : (meta.startDate ? dayjs(meta.startDate) : null);

                if (exportStartDate && pEnd && pEnd.isBefore(dayjs(exportStartDate), 'day')) return false;
                if (exportEndDate && pStart && pStart.isAfter(dayjs(exportEndDate), 'day')) return false;
            }

            return true;
        });
    }, [plans, exportStartDate, exportEndDate, exportCategory, exportPriority, exportStatus, exportStaffFilter, isKabid]);

    const handleExportWorkPlanPDF = () => {
        try {
            setExportingPdf(true);
            const doc = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            const pageW = doc.internal.pageSize.getWidth();
            const pageH = doc.internal.pageSize.getHeight();

            // Kop Surat Yayasan
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.setTextColor(15, 23, 42);
            doc.text('YAYASAN DAR EL IMAN', pageW / 2, 13, { align: 'center' });

            doc.setFontSize(10);
            doc.setTextColor(30, 58, 138);
            doc.text('BIDANG SARANA', pageW / 2, 18, { align: 'center' });

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(71, 85, 105);
            doc.text('Jl. Gunung Juaro, Kel. Surau Gadang, Kec. Nanggalo, Kota Padang, Sumatera Barat', pageW / 2, 22.5, { align: 'center' });

            doc.setDrawColor(15, 23, 42);
            doc.setLineWidth(0.6);
            doc.line(14, 25.5, pageW - 14, 25.5);
            doc.setLineWidth(0.2);
            doc.line(14, 26.5, pageW - 14, 26.5);

            // Judul Dokumen
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(15, 23, 42);
            doc.text('LAPORAN REKAPITULASI RENCANA KERJA & TARGET OPERASIONAL (WORK PLAN)', pageW / 2, 33, { align: 'center' });

            const sDateFormatted = exportStartDate ? dayjs(exportStartDate).format('DD MMMM YYYY') : 'Awal';
            const eDateFormatted = exportEndDate ? dayjs(exportEndDate).format('DD MMMM YYYY') : 'Sekarang';
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(100, 116, 139);
            doc.text(`Periode: ${sDateFormatted} s.d. ${eDateFormatted}`, pageW / 2, 37.5, { align: 'center' });

            // Summary Metrics Box
            const total = plansForExport.length;
            let doneCount = 0;
            let activeCount = 0;
            let sumPct = 0;

            plansForExport.forEach(p => {
                const meta = p.metadata || {};
                const items = meta.items || [];
                let pct = 0;
                let isDone = false;
                if (items.length > 0) {
                    pct = Math.round(items.reduce((acc, curr) => acc + (curr.percentage || 0), 0) / items.length);
                    isDone = pct === 100 || items.every(i => i.status === 'SELESAI' || i.percentage === 100);
                } else {
                    isDone = meta.status === 'SELESAI' || meta.percentage === 100;
                    pct = meta.percentage !== undefined ? meta.percentage : (meta.status === 'SELESAI' ? 100 : 0);
                }
                if (isDone) doneCount++; else activeCount++;
                sumPct += pct;
            });
            const avgRate = total > 0 ? Math.round(sumPct / total) : 0;

            doc.setFillColor(248, 250, 252);
            doc.roundedRect(14, 41, pageW - 28, 11, 2, 2, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(30, 41, 59);
            doc.text(`Total Rencana: ${total}`, 20, 47.5);
            doc.text(`Selesai (100%): ${doneCount}`, 75, 47.5);
            doc.text(`Sedang Berjalan: ${activeCount}`, 130, 47.5);
            doc.text(`Rata-rata Capaian: ${avgRate}%`, 190, 47.5);
            doc.text(`Dicetak: ${dayjs().format('DD/MM/YYYY HH:mm')}`, 240, 47.5);

            // Table Data
            const tableHeaders = [
                ['No', 'Judul Rencana Kerja', 'Posisi / Jabatan', 'Kategori', 'Prioritas', 'Periode Target', 'Progres', 'Status', 'Rincian Langkah Target']
            ];

            const tableRows = plansForExport.map((p, idx) => {
                const meta = p.metadata || {};
                const items = meta.items || [];
                let pct = 0;
                let isDone = false;
                if (items.length > 0) {
                    pct = Math.round(items.reduce((acc, curr) => acc + (curr.percentage || 0), 0) / items.length);
                    isDone = pct === 100 || items.every(i => i.status === 'SELESAI' || i.percentage === 100);
                } else {
                    isDone = meta.status === 'SELESAI' || meta.percentage === 100;
                    pct = meta.percentage !== undefined ? meta.percentage : (meta.status === 'SELESAI' ? 100 : 0);
                }

                const sStr = meta.startDate ? dayjs(meta.startDate).format('DD/MM/YY') : '-';
                const eStr = meta.endDate ? dayjs(meta.endDate).format('DD/MM/YY') : '-';
                const stepsSummary = items.length > 0
                    ? items.map((it, i) => `${i + 1}. [${it.status === 'SELESAI' || it.percentage === 100 ? 'Selesai' : `${it.percentage || 0}%`}] ${it.activity || it.text || ''}`).join('\n')
                    : (p.content || '-');

                return [
                    idx + 1,
                    meta.title || p.content || 'Rencana Kerja',
                    meta.position || p.user?.position || 'Staf Sarana',
                    p.category || meta.categoryTag || 'UMUM',
                    meta.priority || 'SEDANG',
                    `${sStr} s/d ${eStr}`,
                    `${pct}%`,
                    isDone ? 'SELESAI' : 'AKTIF',
                    stepsSummary
                ];
            });

            autoTable(doc, {
                startY: 55,
                head: tableHeaders,
                body: tableRows,
                theme: 'grid',
                styles: {
                    fontSize: 7.5,
                    cellPadding: 2,
                    textColor: [15, 23, 42],
                    lineColor: [226, 232, 240],
                    lineWidth: 0.1
                },
                headStyles: {
                    fillColor: [30, 41, 59],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    halign: 'center'
                },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 10 },
                    1: { cellWidth: 50, fontStyle: 'bold' },
                    2: { cellWidth: 32 },
                    3: { halign: 'center', cellWidth: 20 },
                    4: { halign: 'center', cellWidth: 18 },
                    5: { halign: 'center', cellWidth: 26 },
                    6: { halign: 'center', cellWidth: 16 },
                    7: { halign: 'center', cellWidth: 18 },
                    8: { cellWidth: 'auto' }
                },
                margin: { left: 14, right: 14, bottom: 25 },
                didDrawPage: (data) => {
                    const str = `Halaman ${doc.internal.getNumberOfPages()}`;
                    doc.setFontSize(8);
                    doc.setTextColor(148, 163, 184);
                    doc.text(str, pageW - 14, pageH - 10, { align: 'right' });
                    doc.text('Sistem Informasi Manajemen Aset & Sarpras Yayasan Dar El Iman Padang', 14, pageH - 10);
                }
            });

            // Signature block on the last page (Digital TTE Kepala Bidang Sarana)
            const finalY = doc.lastAutoTable?.finalY || 100;
            const signBoxW = 72;
            const signBoxH = 26;
            const signBoxX = pageW - signBoxW - 14;
            const signY = (finalY + 45 > pageH) ? 20 : finalY + 10;
            if (finalY + 45 > pageH) {
                doc.addPage();
            }

            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(15, 23, 42);
            doc.text(`Padang, ${dayjs().format('DD MMMM YYYY')}`, signBoxX + (signBoxW / 2), signY, { align: 'center' });
            doc.setFont('helvetica', 'bold');
            doc.text('Kepala Bidang Sarana', signBoxX + (signBoxW / 2), signY + 4.5, { align: 'center' });

            // TTE Box
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(203, 213, 225);
            doc.setLineWidth(0.3);
            doc.roundedRect(signBoxX, signY + 7, signBoxW, signBoxH, 2, 2, 'FD');

            doc.setFillColor(16, 185, 129);
            doc.roundedRect(signBoxX + 1.5, signY + 8.5, 3, signBoxH - 3, 1, 1, 'F');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.2);
            doc.setTextColor(5, 150, 105);
            doc.text('DITANDATANGANI SECARA ELEKTRONIK (TTE)', signBoxX + 7, signY + 13);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.setTextColor(71, 85, 105);
            doc.text('Dokumen Sah & Terverifikasi Sistem E-Office', signBoxX + 7, signY + 17.5);
            doc.text('Yayasan Dar el Iman Padang', signBoxX + 7, signY + 21.5);

            doc.setFont('helvetica', 'italic');
            doc.setFontSize(6);
            doc.setTextColor(100, 116, 139);
            doc.text(`ID: TTE-${dayjs().format('YYYYMMDD')}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`, signBoxX + 7, signY + 25.5);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(15, 23, 42);
            doc.text('Ravi Kurnia, S.T.', signBoxX + (signBoxW / 2), signY + 38, { align: 'center' });
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(71, 85, 105);
            doc.text('Kepala Bidang Sarana', signBoxX + (signBoxW / 2), signY + 42, { align: 'center' });

            doc.save(`Laporan_Rencana_Kerja_${exportStartDate || 'All'}_sd_${exportEndDate || 'All'}.pdf`);
        } catch (err) {
            console.error('Failed to export Work Plan PDF:', err);
            alert('Gagal mengekspor dokumen PDF rencana kerja: ' + err.message);
        } finally {
            setExportingPdf(false);
        }
    };

    const handleExportWorkPlanExcel = () => {
        try {
            const summaryRows = plansForExport.map((p, idx) => {
                const meta = p.metadata || {};
                const items = meta.items || [];
                let pct = 0;
                let isDone = false;
                if (items.length > 0) {
                    pct = Math.round(items.reduce((acc, curr) => acc + (curr.percentage || 0), 0) / items.length);
                    isDone = pct === 100 || items.every(i => i.status === 'SELESAI' || i.percentage === 100);
                } else {
                    isDone = meta.status === 'SELESAI' || meta.percentage === 100;
                    pct = meta.percentage !== undefined ? meta.percentage : (meta.status === 'SELESAI' ? 100 : 0);
                }

                return {
                    'No': idx + 1,
                    'Judul Rencana': meta.title || p.content || '-',
                    'Posisi / Jabatan': meta.position || p.user?.position || '-',
                    'Kategori': p.category || meta.categoryTag || 'UMUM',
                    'Prioritas': meta.priority || 'SEDANG',
                    'Tanggal Mulai': meta.startDate ? dayjs(meta.startDate).format('DD/MM/YYYY') : '-',
                    'Target Selesai': meta.endDate ? dayjs(meta.endDate).format('DD/MM/YYYY') : '-',
                    'Status': isDone ? 'SELESAI' : 'AKTIF',
                    'Capaian (%)': pct,
                    'Total Langkah': items.length,
                    'Langkah Selesai': items.filter(i => i.status === 'SELESAI' || i.percentage === 100).length
                };
            });

            const stepRows = [];
            plansForExport.forEach((p, pIdx) => {
                const meta = p.metadata || {};
                const items = meta.items || [];
                items.forEach((it, sIdx) => {
                    stepRows.push({
                        'No Rencana': pIdx + 1,
                        'Judul Rencana': meta.title || p.content || '-',
                        'Posisi / Jabatan': meta.position || p.user?.position || '-',
                        'No Langkah': sIdx + 1,
                        'Aktivitas / Langkah': it.activity || it.text || '-',
                        'Estimasi Target': it.targetDate ? dayjs(it.targetDate).format('DD/MM/YYYY') : '-',
                        'Status Langkah': it.status || 'PENDING',
                        'Progres (%)': it.percentage !== undefined ? it.percentage : (it.status === 'SELESAI' ? 100 : 0)
                    });
                });
            });

            const wb = XLSX.utils.book_new();
            const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
            XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan_Rencana');

            if (stepRows.length > 0) {
                const wsSteps = XLSX.utils.json_to_sheet(stepRows);
                XLSX.utils.book_append_sheet(wb, wsSteps, 'Rincian_Langkah');
            }

            XLSX.writeFile(wb, `Laporan_Rencana_Kerja_${exportStartDate || 'All'}_sd_${exportEndDate || 'All'}.xlsx`);
        } catch (err) {
            console.error('Failed to export Work Plan Excel:', err);
            alert('Gagal mengekspor berkas Excel rencana kerja: ' + err.message);
        }
    };

    // Modal / Form state for Create & Edit Plan
    const [showFormModal, setShowFormModal] = useState(false);
    const [editingPlan, setEditingPlan] = useState(null);
    const [loadingAiBreakdown, setLoadingAiBreakdown] = useState(false);
    const [planForm, setPlanForm] = useState({
        title: '',
        position: user.position || '',
        category: getUserCategory(user.position, userDivision),
        priority: 'SEDANG',
        startDate: dayjs().format('YYYY-MM-DD'),
        endDate: dayjs().add(7, 'day').format('YYYY-MM-DD'),
        notes: '',
        items: []
    });

    // Modal state for 100% completion with photo proof & direct Daily Report sync
    const [completionModal, setCompletionModal] = useState({
        isOpen: false,
        plan: null,
        item: null,
        itemIndex: null, // null for single-goal plan
        photoFile: null,
        photoPreview: null,
        syncToDailyReport: true,
        sessionPeriod: dayjs().hour() < 12 ? 'morning' : 'afternoon'
    });
    const [uploadingCompletion, setUploadingCompletion] = useState(false);
    const [lightboxPhoto, setLightboxPhoto] = useState(null);
    const completionFileInputRef = useRef(null);

    // AI Polish for Plan Form Title & Steps
    const [polishingPlanItemIdx, setPolishingPlanItemIdx] = useState(null);
    const [polishingPlanTitle, setPolishingPlanTitle] = useState(false);

    const handlePolishPlanTitle = async () => {
        if (!planForm.title?.trim()) return;
        try {
            setPolishingPlanTitle(true);
            const res = await api.post('/laporan/ai/polish-text', {
                text: planForm.title,
                categoryTag: planForm.category || userDivision || 'UMUM',
                mode: 'activity'
            });
            if (res.data?.success && res.data?.polished) {
                setPlanForm(prev => ({
                    ...prev,
                    title: res.data.polished.replace(/\.$/, '')
                }));
            }
        } catch (err) {
            console.error('Failed to polish plan title:', err);
            alert('Gagal merapikan judul rencana.');
        } finally {
            setPolishingPlanTitle(false);
        }
    };

    const handlePolishPlanItem = async (index) => {
        const item = planForm.items[index];
        if (!item?.activity?.trim()) return;

        try {
            setPolishingPlanItemIdx(index);
            const res = await api.post('/laporan/ai/polish-text', {
                text: item.activity,
                categoryTag: planForm.category || userDivision || 'UMUM',
                mode: 'activity'
            });
            if (res.data?.success && res.data?.polished) {
                handleItemChange(index, 'activity', res.data.polished.replace(/\.$/, ''));
            }
        } catch (err) {
            console.error('Failed to polish step activity:', err);
            alert('Gagal merapikan teks langkah.');
        } finally {
            setPolishingPlanItemIdx(null);
        }
    };

    // Open 100% Completion Modal
    const handleOpenCompletionModal = (plan, item = null, itemIndex = null) => {
        setCompletionModal({
            isOpen: true,
            plan,
            item,
            itemIndex,
            photoFile: null,
            photoPreview: null,
            syncToDailyReport: true,
            sessionPeriod: dayjs().hour() < 12 ? 'morning' : 'afternoon'
        });
    };

    const handleCompletionPhotoSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            alert('Berkas harus berupa gambar (JPG, PNG, JPEG, WebP).');
            return;
        }
        if (file.size > 15 * 1024 * 1024) {
            alert('Ukuran berkas maksimal 15MB.');
            return;
        }
        const previewUrl = URL.createObjectURL(file);
        setCompletionModal(prev => ({
            ...prev,
            photoFile: file,
            photoPreview: previewUrl
        }));
    };

    const handleRemoveCompletionPhoto = () => {
        if (completionModal.photoPreview) {
            URL.revokeObjectURL(completionModal.photoPreview);
        }
        if (completionFileInputRef.current) {
            completionFileInputRef.current.value = '';
        }
        setCompletionModal(prev => ({
            ...prev,
            photoFile: null,
            photoPreview: null
        }));
    };

    const handleSubmitCompletion = async (e) => {
        if (e) e.preventDefault();
        const { plan, item, itemIndex, photoFile, syncToDailyReport, sessionPeriod } = completionModal;
        if (!plan) return;

        try {
            setUploadingCompletion(true);
            let uploadedPhotos = [];

            // 1. Upload photo if attached
            if (photoFile) {
                try {
                    const base64Str = await compressImageToBase64(photoFile);
                    const res = await api.post('/laporan/upload-photo', { base64: base64Str });
                    if (res.data?.success && res.data?.url) {
                        uploadedPhotos = [{
                            url: res.data.url,
                            timestamp: res.data.timestamp || new Date().toISOString()
                        }];
                    }
                } catch (uploadErr) {
                    console.error('Failed to upload proof photo:', uploadErr);
                    if (!window.confirm('Gagal mengunggah foto bukti ke server. Tetap lanjutkan penyelesaian 100% tanpa bukti foto?')) {
                        setUploadingCompletion(false);
                        return;
                    }
                }
            }

            // 2. Mark Plan or Sub-item as 100% SELESAI
            const isSingleGoal = itemIndex === null;
            if (isSingleGoal) {
                const extraMeta = {
                    percentage: 100,
                    status: 'SELESAI',
                    ...(uploadedPhotos.length > 0 ? { photos: uploadedPhotos } : {})
                };
                await handleTogglePlanStatus(plan, extraMeta);
            } else {
                const updates = {
                    percentage: 100,
                    status: 'SELESAI',
                    ...(uploadedPhotos.length > 0 ? { photos: uploadedPhotos } : {})
                };
                await handleUpdatePlanItem(plan, itemIndex, updates);
            }

            // 3. Directly import into Laporan Harian if selected
            if (syncToDailyReport && onImportPlanItemToReport) {
                onImportPlanItemToReport(plan, item, itemIndex, sessionPeriod, uploadedPhotos);
            }

            // 4. Cleanup and close modal
            handleRemoveCompletionPhoto();
            setCompletionModal({
                isOpen: false,
                plan: null,
                item: null,
                itemIndex: null,
                photoFile: null,
                photoPreview: null,
                syncToDailyReport: true,
                sessionPeriod: 'morning'
            });
        } catch (err) {
            console.error('Error completing plan item:', err);
            alert('Gagal menyimpan penyelesaian rencana kerja: ' + (err.response?.data?.error || err.message));
        } finally {
            setUploadingCompletion(false);
        }
    };

    // Open Create Modal
    const handleOpenCreateModal = () => {
        setEditingPlan(null);
        setPlanForm({
            title: '',
            position: user.position || '',
            category: getUserCategory(user.position, userDivision),
            priority: 'SEDANG',
            startDate: dayjs().format('YYYY-MM-DD'),
            endDate: dayjs().add(7, 'day').format('YYYY-MM-DD'),
            notes: '',
            items: []
        });
        setShowFormModal(true);
    };

    // Open Edit Modal
    const handleOpenEditModal = (plan) => {
        setEditingPlan(plan);
        const meta = plan.metadata || {};
        const planItems = Array.isArray(meta.items) && meta.items.length > 0 
            ? meta.items.map(it => ({
                activity: it.activity || it.text || '',
                targetDate: it.targetDate ? dayjs(it.targetDate).format('YYYY-MM-DD') : '',
                status: it.status || 'PENDING',
                percentage: it.percentage !== undefined ? it.percentage : 0
            }))
            : [];

        setPlanForm({
            title: meta.title || '',
            position: meta.position || plan.user?.position || user.position || '',
            category: plan.category || getUserCategory(user.position, userDivision),
            priority: meta.priority || 'SEDANG',
            startDate: meta.startDate ? dayjs(meta.startDate).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
            endDate: meta.endDate ? dayjs(meta.endDate).format('YYYY-MM-DD') : dayjs().add(7, 'day').format('YYYY-MM-DD'),
            notes: plan.content || '',
            items: planItems
        });
        setShowFormModal(true);
    };

    // AI Task Breakdown Handler
    const handleAiBreakdown = async () => {
        if (!planForm.title.trim()) {
            alert('Silakan ketik Judul Rencana Kerja terlebih dahulu agar AI dapat merinci langkah yang sesuai.');
            return;
        }

        try {
            setLoadingAiBreakdown(true);
            const res = await api.post('/laporan/ai/breakdown-plan', {
                title: planForm.title,
                position: planForm.position,
                category: planForm.category,
                startDate: planForm.startDate,
                endDate: planForm.endDate,
                priority: planForm.priority
            });

            if (res.data?.success && res.data?.data) {
                const aiData = res.data.data;
                const newItems = Array.isArray(aiData.steps) ? aiData.steps.map(s => ({
                    activity: s.activity || '',
                    targetDate: s.targetDate || planForm.endDate,
                    status: 'PENDING',
                    percentage: 0
                })) : [];

                setPlanForm(prev => ({
                    ...prev,
                    priority: aiData.priority || prev.priority,
                    items: newItems,
                    notes: aiData.scopeNote || prev.notes
                }));

                alert(`✨ AI Berhasil merinci ${newItems.length} langkah pengerjaan dan merekomendasikan prioritas: ${aiData.priority || 'SEDANG'}!`);
            }
        } catch (err) {
            console.error('AI Breakdown error:', err);
            alert(err.response?.data?.error || 'Gagal merinci langkah dengan AI. Silakan coba lagi.');
        } finally {
            setLoadingAiBreakdown(false);
        }
    };

    // Handle Item inputs in Form
    const handleItemChange = (index, field, value) => {
        const newItems = [...planForm.items];
        if (field === 'targetDate') {
            if (value && planForm.endDate && dayjs(value).isAfter(dayjs(planForm.endDate), 'day')) {
                alert(`Tanggal estimasi langkah tidak boleh melebihi estimasi selesai judul (${dayjs(planForm.endDate).format('DD/MM/YYYY')}).`);
                value = planForm.endDate;
            }
        }
        newItems[index] = { ...newItems[index], [field]: value };
        setPlanForm({ ...planForm, items: newItems });
    };

    const handleAddItemField = () => {
        setPlanForm({
            ...planForm,
            items: [
                ...planForm.items, 
                { 
                    activity: '', 
                    targetDate: planForm.endDate || dayjs().add(3, 'day').format('YYYY-MM-DD'), 
                    status: 'PENDING', 
                    percentage: 0 
                }
            ]
        });
    };

    const handleRemoveItemField = (index) => {
        const newItems = planForm.items.filter((_, i) => i !== index);
        setPlanForm({ ...planForm, items: newItems });
    };

    // When main endDate changes, warn/adjust if step targetDates exceed it
    const handleMainEndDateChange = (newEndDate) => {
        const adjustedItems = planForm.items.map(it => {
            if (it.targetDate && dayjs(it.targetDate).isAfter(dayjs(newEndDate), 'day')) {
                return { ...it, targetDate: newEndDate };
            }
            return it;
        });
        setPlanForm({ ...planForm, endDate: newEndDate, items: adjustedItems });
    };

    // Submit Plan Form
    const onSubmitPlanForm = async (e) => {
        e.preventDefault();
        if (!planForm.title.trim()) {
            alert('Judul rencana kerja wajib diisi');
            return;
        }
        if (!planForm.endDate) {
            alert('Tanggal estimasi selesai rencana kerja wajib diisi');
            return;
        }

        // Validate items if any
        const validItems = planForm.items.filter(i => i.activity.trim());
        const hasDateBeyondDeadline = validItems.some(i => i.targetDate && dayjs(i.targetDate).isAfter(dayjs(planForm.endDate), 'day'));
        if (hasDateBeyondDeadline) {
            alert(`Terdapat langkah dengan tanggal estimasi yang melebihi batas estimasi selesai judul (${dayjs(planForm.endDate).format('DD/MM/YYYY')}). Mohon sesuaikan.`);
            return;
        }

        const success = await handleCreateOrUpdatePlan({
            id: editingPlan?.id,
            ...planForm,
            items: validItems
        });

        if (success) {
            setShowFormModal(false);
            setEditingPlan(null);
        }
    };

    // Filtered plans
    const filteredPlans = useMemo(() => {
        return plans.filter(p => {
            const meta = p.metadata || {};
            const items = meta.items || [];
            
            let isDone = false;
            if (items.length > 0) {
                const avgPct = Math.round(items.reduce((acc, curr) => acc + (curr.percentage || 0), 0) / items.length);
                isDone = avgPct === 100 || items.every(i => i.status === 'SELESAI' || i.percentage === 100);
            } else {
                isDone = meta.status === 'SELESAI' || meta.percentage === 100;
            }

            // Status filter
            if (filterStatus === 'ACTIVE' && isDone) return false;
            if (filterStatus === 'DONE' && !isDone) return false;

            // Priority filter
            const planPriority = meta.priority || 'SEDANG';
            if (filterPriority !== 'ALL' && planPriority !== filterPriority) return false;

            // Category filter
            if (filterCategory !== 'ALL' && p.category !== filterCategory && meta.categoryTag !== filterCategory) return false;

            // Staff filter (for Kabid)
            if (isKabid && selectedStaffFilter !== 'ALL' && p.userId !== parseInt(selectedStaffFilter)) {
                return false;
            }

            // Search query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchTitle = (meta.title || '').toLowerCase().includes(q);
                const matchContent = (p.content || '').toLowerCase().includes(q);
                const matchPosition = (meta.position || p.user?.position || '').toLowerCase().includes(q);
                const matchItems = items.some(it => (it.activity || '').toLowerCase().includes(q));
                const matchStaff = (p.user?.name || '').toLowerCase().includes(q);
                if (!matchTitle && !matchContent && !matchPosition && !matchItems && !matchStaff) return false;
            }

            return true;
        });
    }, [plans, filterStatus, filterPriority, filterCategory, selectedStaffFilter, searchQuery, isKabid]);

    // Statistics
    const stats = useMemo(() => {
        const total = plans.length;
        let done = 0;
        let active = 0;
        let totalPctSum = 0;

        plans.forEach(p => {
            const meta = p.metadata || {};
            const items = meta.items || [];
            let planPct = 0;
            let planDone = false;

            if (items.length > 0) {
                planPct = Math.round(items.reduce((acc, curr) => acc + (curr.percentage || 0), 0) / items.length);
                planDone = planPct === 100 || items.every(i => i.status === 'SELESAI' || i.percentage === 100);
            } else {
                planDone = meta.status === 'SELESAI' || meta.percentage === 100;
                planPct = planDone ? 100 : (meta.percentage || 0);
            }

            if (planDone) {
                done++;
            } else {
                active++;
            }
            totalPctSum += planPct;
        });

        const overallAvg = total > 0 ? Math.round(totalPctSum / total) : 0;
        return { total, done, active, overallAvg };
    }, [plans]);

    const todayStr = dayjs().format('YYYY-MM-DD');
    const tomorrowStr = dayjs().add(1, 'day').format('YYYY-MM-DD');

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* 1. HERO STATS & ACTION HEADER */}
            <div className="bg-gradient-to-br from-white to-slate-50 p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-violet-500/20 shrink-0">
                            <Target className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">
                                    {isKabid ? 'Perencanaan & Target Kerja Tim' : 'Perencanaan Kerja Saya'}
                                </h2>
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-violet-100 text-violet-700">
                                    Work Plan
                                </span>
                            </div>
                            <p className="text-slate-500 text-xs font-medium mt-0.5">
                                {isKabid
                                    ? 'Pantau milestone target kerja tim, prioritas pekerjaan, integrasi dua arah ke Laporan Harian, dan reminder WA jam 07:50 WIB.'
                                    : 'Tetapkan target kerja terarah, gunakan AI untuk rincian langkah otomatis, sinkronisasi dua arah ke laporan harian, dan notifikasi WA setiap pagi.'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                            type="button"
                            onClick={() => setShowExportModal(true)}
                            className="px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shadow-2xs hover:shadow-sm active:scale-95 cursor-pointer"
                            title="Ekspor laporan rencana kerja berdasarkan rentang tanggal"
                        >
                            <Download size={16} className="text-violet-600" /> Ekspor Rencana Kerja
                        </button>
                        <button
                            type="button"
                            onClick={handleOpenCreateModal}
                            className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shadow-md shadow-violet-600/20 active:scale-95 cursor-pointer"
                        >
                            <Plus size={16} /> Buat Rencana Kerja
                        </button>
                    </div>
                </div>

                {/* KPI Metrics Mini Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 pt-2 border-t border-slate-100">
                    <div className="p-3 bg-white border border-slate-200/80 rounded-2xl shadow-2xs">
                        <div className="flex items-center justify-between text-slate-400 mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider">Total Rencana</span>
                            <Layers size={14} className="text-violet-500" />
                        </div>
                        <div className="text-xl sm:text-2xl font-black text-slate-800">{stats.total}</div>
                    </div>
                    <div className="p-3 bg-white border border-slate-200/80 rounded-2xl shadow-2xs">
                        <div className="flex items-center justify-between text-slate-400 mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider">Sedang Berjalan</span>
                            <Zap size={14} className="text-amber-500" />
                        </div>
                        <div className="text-xl sm:text-2xl font-black text-amber-600">{stats.active}</div>
                    </div>
                    <div className="p-3 bg-white border border-slate-200/80 rounded-2xl shadow-2xs">
                        <div className="flex items-center justify-between text-slate-400 mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider">Selesai 100%</span>
                            <CheckCircle2 size={14} className="text-emerald-500" />
                        </div>
                        <div className="text-xl sm:text-2xl font-black text-emerald-600">{stats.done}</div>
                    </div>
                    <div className="p-3 bg-white border border-slate-200/80 rounded-2xl shadow-2xs">
                        <div className="flex items-center justify-between text-slate-400 mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider">Rata-rata Capaian</span>
                            <BarChart3 size={14} className="text-indigo-500" />
                        </div>
                        <div className="text-xl sm:text-2xl font-black text-indigo-600">{stats.overallAvg}%</div>
                    </div>
                </div>
            </div>

            {/* 2. FILTER & SEARCH BAR */}
            <div className="bg-white p-4 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    {/* Status Tabs */}
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                        <button
                            type="button"
                            onClick={() => setFilterStatus('ACTIVE')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                filterStatus === 'ACTIVE' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            Aktif ({stats.active})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterStatus('ALL')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                filterStatus === 'ALL' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            Semua ({stats.total})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterStatus('DONE')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                filterStatus === 'DONE' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            Selesai ({stats.done})
                        </button>
                    </div>

                    {/* Priority Filter */}
                    <select
                        value={filterPriority}
                        onChange={(e) => setFilterPriority(e.target.value)}
                        className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
                    >
                        <option value="ALL">Semua Prioritas</option>
                        <option value="TINGGI">🔴 Prioritas Tinggi</option>
                        <option value="SEDANG">🟡 Prioritas Sedang</option>
                        <option value="RENDAH">🟢 Prioritas Rendah</option>
                    </select>

                    {/* Category Filter */}
                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
                    >
                        <option value="ALL">Semua Kategori</option>
                        {DIVISION_TAGS.map(d => (
                            <option key={d.key} value={d.key}>{d.label}</option>
                        ))}
                    </select>

                    {/* Staff Filter (If Kabid) */}
                    {isKabid && (
                        <select
                            value={selectedStaffFilter}
                            onChange={(e) => setSelectedStaffFilter(e.target.value)}
                            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
                        >
                            <option value="ALL">Semua Staf Sarana</option>
                            {staffList.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    )}
                </div>

                {/* Search Box */}
                <div className="relative min-w-[200px] sm:min-w-[240px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Cari judul / langkah target..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:bg-white focus:border-violet-500 transition-all"
                    />
                </div>
            </div>

            {/* 3. PLANS CARD LIST */}
            <div className="space-y-4">
                {loadingPlans ? (
                    <div className="p-12 text-center text-slate-400 bg-white rounded-3xl border border-slate-100 shadow-sm font-bold flex flex-col items-center justify-center gap-2">
                        <RotateCcw className="animate-spin text-violet-600" size={24} />
                        <span>Memuat data perencanaan kerja...</span>
                    </div>
                ) : filteredPlans.length === 0 ? (
                    <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-200 shadow-sm space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-500 flex items-center justify-center mx-auto">
                            <Target size={24} />
                        </div>
                        <h4 className="text-sm font-black text-slate-700">Belum Ada Rencana Kerja</h4>
                        <p className="text-xs text-slate-400 max-w-sm mx-auto">
                            {searchQuery || filterCategory !== 'ALL' || filterStatus !== 'ACTIVE' || filterPriority !== 'ALL'
                                ? 'Tidak ada rencana kerja yang cocok dengan filter atau kata kunci saat ini.'
                                : 'Susun rencana kerja Anda dengan judul, prioritas, langkah opsional, dan tanggal estimasi selesai agar terpantau teratur.'}
                        </p>
                        <button
                            type="button"
                            onClick={handleOpenCreateModal}
                            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
                        >
                            <Plus size={14} /> Buat Rencana Kerja Pertama
                        </button>
                    </div>
                ) : (
                    filteredPlans.map(plan => {
                        const meta = plan.metadata || {};
                        const items = Array.isArray(meta.items) ? meta.items : [];
                        const hasItems = items.length > 0;

                        let doneCount = 0;
                        let avgPct = 0;
                        let isDone = false;

                        if (hasItems) {
                            doneCount = items.filter(i => i.percentage === 100 || i.status === 'SELESAI').length;
                            avgPct = Math.round(items.reduce((acc, curr) => acc + (curr.percentage || 0), 0) / items.length);
                            isDone = avgPct === 100 || doneCount === items.length;
                        } else {
                            isDone = meta.status === 'SELESAI' || meta.percentage === 100;
                            avgPct = isDone ? 100 : (meta.percentage || 0);
                            doneCount = isDone ? 1 : 0;
                        }

                        const isOwner = user.id === plan.userId;
                        const endDateStr = meta.endDate ? dayjs(meta.endDate).format('YYYY-MM-DD') : '';
                        const isOverdue = !isDone && endDateStr && dayjs().isAfter(dayjs(endDateStr), 'day');
                        const isDueToday = !isDone && endDateStr === todayStr;
                        const isDueTomorrow = !isDone && endDateStr === tomorrowStr;

                        const displayPosition = meta.position || plan.user?.position || plan.category || 'Staff Sarpras';
                        const planPriority = meta.priority || 'SEDANG';

                        return (
                            <div 
                                key={plan.id} 
                                className={`bg-white p-5 sm:p-6 rounded-3xl border transition-all space-y-4 ${
                                    isOverdue 
                                        ? 'border-rose-200/90 shadow-xs ring-1 ring-rose-100' 
                                        : isDueToday 
                                            ? 'border-amber-200/90 shadow-xs ring-1 ring-amber-100' 
                                            : 'border-slate-100 shadow-sm hover:shadow-md'
                                }`}
                            >
                                {/* Plan Header */}
                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                    <div className="space-y-1.5 flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            {/* Status Badge */}
                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                isDone ? 'bg-emerald-100 text-emerald-700' : 'bg-violet-100 text-violet-700'
                                            }`}>
                                                {isDone ? 'SELESAI 100%' : 'DALAM PROGRES'}
                                            </span>

                                            {/* Priority Badge */}
                                            {planPriority === 'TINGGI' ? (
                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1 shadow-2xs">
                                                    <Flame size={11} className="fill-rose-500 text-rose-500" /> Prioritas Tinggi
                                                </span>
                                            ) : planPriority === 'RENDAH' ? (
                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    Prioritas Rendah
                                                </span>
                                            ) : (
                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                                                    Prioritas Sedang
                                                </span>
                                            )}

                                            {/* Position / Division Badge */}
                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-100/70" title="Kategori divisi sesuai posisi pengisi">
                                                {displayPosition}
                                            </span>

                                            {/* Deadline / Estimated Finish Badge */}
                                            {isDone ? (
                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 flex items-center gap-1">
                                                    <Check size={11} /> Tuntas
                                                </span>
                                            ) : isOverdue ? (
                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-200 animate-pulse flex items-center gap-1" title="Melewati tanggal estimasi selesai">
                                                    <AlertCircle size={11} /> Overdue: {dayjs(endDateStr).format('D MMM YYYY')}
                                                </span>
                                            ) : isDueToday ? (
                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                                                    <Clock size={11} /> Jatuh Tempo Hari Ini
                                                </span>
                                            ) : isDueTomorrow ? (
                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                                                    <Clock size={11} /> Batas Besok ({dayjs(endDateStr).format('D MMM')})
                                                </span>
                                            ) : endDateStr ? (
                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 flex items-center gap-1">
                                                    <Calendar size={11} /> Estimasi Selesai: {dayjs(endDateStr).format('D MMM YYYY')}
                                                </span>
                                            ) : null}

                                            {/* Calendar sync badge */}
                                            {meta.calendarEventId && (
                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-sky-50 text-sky-600 flex items-center gap-1" title="Tersinkronisasi otomatis ke Kalender Sarpras">
                                                    <Calendar size={10} /> Kalender Sarpras
                                                </span>
                                            )}

                                            {/* Owner name (if viewed by Kabid) */}
                                            {isKabid && plan.user && (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 flex items-center gap-1">
                                                    <User size={10} /> {plan.user.name}
                                                </span>
                                            )}
                                        </div>

                                        <h3 className={`text-base font-black text-slate-800 ${isDone ? 'line-through text-slate-400' : ''}`}>
                                            {meta.title || 'Rencana Kerja'}
                                        </h3>

                                        {plan.content && (
                                            <p className="text-xs text-slate-500 font-medium line-clamp-2">
                                                {plan.content}
                                            </p>
                                        )}
                                    </div>

                                    {/* Action Buttons for Plan Owner / Kabid */}
                                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                                        {(isOwner || isKabid) && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenEditModal(plan)}
                                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition cursor-pointer"
                                                    title="Edit Rencana Kerja"
                                                >
                                                    <Edit3 size={15} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (window.confirm(`Yakin ingin menghapus rencana "${meta.title || 'Rencana Kerja'}"? Agenda kalender terkait juga akan dibersihkan.`)) {
                                                            handleDeletePlan(plan.id);
                                                        }
                                                    }}
                                                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                                                    title="Hapus Rencana Kerja"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Plan Progress Bar */}
                                <div className="space-y-1 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
                                    <div className="flex items-center justify-between text-xs font-bold">
                                        <span className="text-slate-600 flex items-center gap-1.5">
                                            <Target size={13} className="text-violet-600" />
                                            {hasItems 
                                                ? `Capaian Rencana (${doneCount}/${items.length} Langkah Selesai)`
                                                : `Status Target (${isDone ? 'Selesai 100%' : 'Sedang Berjalan'})`}
                                        </span>
                                        <span className={`font-black ${isDone ? 'text-emerald-600' : 'text-violet-600'}`}>
                                            {avgPct}%
                                        </span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-200/80 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full transition-all duration-500 ${
                                                isDone 
                                                    ? 'bg-emerald-500' 
                                                    : 'bg-gradient-to-r from-violet-600 to-indigo-600'
                                            }`} 
                                            style={{ width: `${avgPct}%` }}
                                        />
                                    </div>
                                </div>

                                {/* SCENARIO A: PLAN WITH SUB-ITEMS (STEPS) */}
                                {hasItems ? (
                                    <div className="space-y-2.5 pt-1">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                                                Langkah-Langkah Rencana ({items.length} Tahap):
                                            </h4>
                                            <span className="text-[10px] text-slate-400 font-medium">
                                                Tersinkronisasi dua arah ke Laporan Harian • Notifikasi WA 07:50 WIB
                                            </span>
                                        </div>
                                        <div className="space-y-2">
                                            {items.map((it, idx) => {
                                                const itemPct = it.percentage !== undefined ? it.percentage : 0;
                                                const itemDone = itemPct === 100 || it.status === 'SELESAI';
                                                const itTargetStr = it.targetDate ? dayjs(it.targetDate).format('YYYY-MM-DD') : '';
                                                const itIsToday = !itemDone && itTargetStr === todayStr;
                                                const itIsOverdue = !itemDone && itTargetStr && dayjs().isAfter(dayjs(itTargetStr), 'day');

                                                return (
                                                    <div 
                                                        key={idx}
                                                        className={`p-3 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                                                            itemDone 
                                                                ? 'bg-emerald-50/40 border-emerald-100/70' 
                                                                : itIsToday
                                                                    ? 'bg-amber-50/50 border-amber-200 shadow-2xs'
                                                                    : itIsOverdue
                                                                        ? 'bg-rose-50/40 border-rose-200'
                                                                        : 'bg-slate-50 border-slate-200/70 hover:border-violet-200'
                                                        }`}
                                                    >
                                                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                                                            <button
                                                                type="button"
                                                                disabled={!isOwner && !isKabid}
                                                                onClick={() => {
                                                                    const newPct = itemDone ? 0 : 100;
                                                                    if (newPct === 100) {
                                                                        handleOpenCompletionModal(plan, it, idx);
                                                                    } else {
                                                                        handleUpdatePlanItem(plan, idx, {
                                                                            percentage: 0,
                                                                            status: 'PENDING'
                                                                        });
                                                                    }
                                                                }}
                                                                className={`mt-0.5 shrink-0 rounded-lg p-0.5 transition cursor-pointer ${
                                                                    itemDone 
                                                                        ? 'text-emerald-600 hover:text-emerald-700' 
                                                                        : 'text-slate-300 hover:text-violet-600'
                                                                }`}
                                                                title={itemDone ? 'Tandai belum selesai' : 'Tandai selesai 100%'}
                                                            >
                                                                <CheckCircle2 size={18} className={itemDone ? 'fill-emerald-100' : ''} />
                                                            </button>
                                                            <div className="min-w-0 flex-1">
                                                                <p className={`text-xs font-bold leading-snug ${itemDone ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                                                                    {it.activity || it.text}
                                                                </p>
                                                                
                                                                {/* Step Info Row: Progress & Target Date */}
                                                                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                                                    <span className={`text-[10px] font-black ${itemDone ? 'text-emerald-600' : itemPct > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                                                                        {itemPct}% Progres
                                                                    </span>

                                                                    {/* Step Target Date Badge */}
                                                                    {it.targetDate && (
                                                                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold flex items-center gap-1 ${
                                                                            itemDone
                                                                                ? 'bg-slate-100 text-slate-500'
                                                                                : itIsToday
                                                                                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                                                                    : itIsOverdue
                                                                                        ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                                                                        : 'bg-violet-50 text-violet-700'
                                                                        }`}>
                                                                            <Calendar size={10} />
                                                                            Target: {dayjs(it.targetDate).format('D MMM YYYY')}
                                                                            {itIsToday && <span className="font-black text-amber-900">• Hari Ini</span>}
                                                                            {itIsOverdue && <span className="font-black text-rose-900">• Terlewat</span>}
                                                                        </span>
                                                                    )}

                                                                    {/* Step Proof Photo Badge */}
                                                                    {((it.photos && it.photos.length > 0) || it.photo) && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setLightboxPhoto(it.photos?.[0]?.url || it.photos?.[0] || it.photo)}
                                                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[9px] font-bold transition cursor-pointer shadow-2xs"
                                                                            title="Klik untuk melihat bukti foto pelaksanaan"
                                                                        >
                                                                            <Camera size={10} className="text-emerald-600" />
                                                                            <span>Bukti Foto</span>
                                                                            <span className="w-3.5 h-3.5 rounded-full bg-emerald-200 text-emerald-800 text-[8px] flex items-center justify-center font-black">
                                                                                {it.photos?.length || 1}
                                                                            </span>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Progress quick buttons & 1-click import */}
                                                        {(isOwner || isKabid) && (
                                                            <div className="flex flex-wrap items-center gap-1.5 shrink-0 self-end md:self-auto">
                                                                {/* Quick percentage adjustment */}
                                                                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                                                                    {[0, 50, 100].map(pct => (
                                                                        <button
                                                                            key={pct}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                if (pct === 100 && itemPct !== 100) {
                                                                                    handleOpenCompletionModal(plan, it, idx);
                                                                                } else {
                                                                                    handleUpdatePlanItem(plan, idx, {
                                                                                        percentage: pct,
                                                                                        status: pct === 100 ? 'SELESAI' : (pct > 0 ? 'PROSES' : 'PENDING')
                                                                                    });
                                                                                }
                                                                            }}
                                                                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                                                                itemPct === pct
                                                                                    ? 'bg-violet-600 text-white shadow-2xs'
                                                                                    : 'text-slate-500 hover:bg-slate-100'
                                                                            }`}
                                                                        >
                                                                            {pct}%
                                                                        </button>
                                                                    ))}
                                                                </div>

                                                                {/* 1-Click Import to Daily Report (Morning / Afternoon) */}
                                                                {isOwner && onImportPlanItemToReport && (
                                                                    <div className="flex items-center gap-1">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => onImportPlanItemToReport(plan, it, idx, 'morning')}
                                                                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-[10px] font-bold transition flex items-center gap-1 cursor-pointer active:scale-95"
                                                                            title="Impor langkah ini ke Laporan Sesi Pagi hari ini"
                                                                        >
                                                                            <Plus size={11} /> Pagi
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => onImportPlanItemToReport(plan, it, idx, 'afternoon')}
                                                                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-[10px] font-bold transition flex items-center gap-1 cursor-pointer active:scale-95"
                                                                            title="Impor langkah ini ke Laporan Sesi Siang hari ini"
                                                                        >
                                                                            <Plus size={11} /> Siang
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    /* SCENARIO B: SINGLE-GOAL PLAN WITHOUT SUB-ITEMS */
                                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-dashed border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-violet-400 shrink-0" />
                                            <p className="text-xs text-slate-500 font-medium">
                                                Rencana kerja mandiri (tanpa butir langkah tambahan).
                                            </p>
                                            {/* Single-Goal Proof Photo Badge */}
                                            {((plan.metadata?.photos && plan.metadata.photos.length > 0) || plan.metadata?.photo) && (
                                                <button
                                                    type="button"
                                                    onClick={() => setLightboxPhoto(plan.metadata.photos?.[0]?.url || plan.metadata.photos?.[0] || plan.metadata.photo)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-bold transition cursor-pointer shadow-2xs"
                                                    title="Klik untuk melihat bukti foto pelaksanaan"
                                                >
                                                    <Camera size={11} className="text-emerald-600" />
                                                    <span>Bukti Foto</span>
                                                    <span className="w-4 h-4 rounded-full bg-emerald-200 text-emerald-800 text-[9px] flex items-center justify-center font-black">
                                                        {plan.metadata.photos?.length || 1}
                                                    </span>
                                                </button>
                                            )}
                                        </div>

                                        {(isOwner || isKabid) && (
                                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                                                {/* Single Toggle Button */}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (!isDone) {
                                                            handleOpenCompletionModal(plan, null, null);
                                                        } else {
                                                            handleTogglePlanStatus && handleTogglePlanStatus(plan);
                                                        }
                                                    }}
                                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95 ${
                                                        isDone
                                                            ? 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                                                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                                    }`}
                                                >
                                                    {isDone ? (
                                                        <>
                                                            <RotateCcw size={13} /> Buka Kembali
                                                        </>
                                                    ) : (
                                                        <>
                                                            <CheckCircle2 size={13} /> Tandai Selesai 100%
                                                        </>
                                                    )}
                                                </button>

                                                {/* 1-Click Import to Daily Report */}
                                                {isOwner && onImportPlanItemToReport && (
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => onImportPlanItemToReport(plan, null, null, 'morning')}
                                                            className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer active:scale-95"
                                                            title="Impor rencana ini ke Laporan Sesi Pagi hari ini"
                                                        >
                                                            <Plus size={12} /> Lapor Pagi
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => onImportPlanItemToReport(plan, null, null, 'afternoon')}
                                                            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer active:scale-95"
                                                            title="Impor rencana ini ke Laporan Sesi Siang hari ini"
                                                        >
                                                            <Plus size={12} /> Lapor Siang
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* 4. MODAL FORM: CREATE / EDIT WORK PLAN */}
            {showFormModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center">
                                    <Target size={18} />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-slate-800">
                                        {editingPlan ? 'Edit Perencanaan Kerja' : 'Buat Perencanaan Kerja Baru'}
                                    </h3>
                                    <p className="text-[11px] text-slate-400 font-medium">
                                        Sinkronisasi dua arah ke Laporan Harian & Pengingat WA 07:50 WIB
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowFormModal(false)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={onSubmitPlanForm} className="space-y-4">
                            {/* 1. Judul Rencana */}
                            <div>
                                <div className="flex items-center justify-between mb-1 gap-2">
                                    <label className="text-xs font-bold text-slate-700">
                                        1. Judul Rencana Kerja <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                        <button
                                            type="button"
                                            disabled={polishingPlanTitle || !planForm.title?.trim()}
                                            onClick={handlePolishPlanTitle}
                                            className="px-2.5 py-1 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-xl text-[11px] font-bold transition flex items-center gap-1 active:scale-95 cursor-pointer disabled:opacity-40"
                                            title="Rapikan kalimat judul rencana kerja menggunakan standar bahasa formal"
                                        >
                                            {polishingPlanTitle ? (
                                                <>
                                                    <RotateCcw size={11} className="animate-spin text-violet-600" />
                                                    <span>Merapikan...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles size={11} className="text-violet-600" />
                                                    <span>Rapikan Judul (AI)</span>
                                                </>
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            disabled={loadingAiBreakdown}
                                            onClick={handleAiBreakdown}
                                            className="px-2.5 py-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl text-[11px] font-bold transition flex items-center gap-1.5 shadow-xs shadow-violet-600/25 active:scale-95 cursor-pointer disabled:opacity-50"
                                            title="Gunakan Google Gemini untuk merinci langkah kerja secara logis & otomatis"
                                        >
                                            {loadingAiBreakdown ? (
                                                <>
                                                    <RotateCcw size={12} className="animate-spin" />
                                                    <span>AI Sedang Merinci...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles size={12} className="text-amber-300 fill-amber-300" />
                                                    <span>AI Rinci Langkah Otomatis</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                                <input
                                    required
                                    type="text"
                                    placeholder="Contoh: Pemeliharaan Rutin Pompa Air Gedung B"
                                    value={planForm.title}
                                    onChange={(e) => setPlanForm({ ...planForm, title: e.target.value })}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                                />
                            </div>

                            {/* Prioritas Rencana Kerja */}
                            <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                                    Tingkat Prioritas Rencana
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPlanForm({ ...planForm, priority: 'TINGGI' })}
                                        className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border ${
                                            planForm.priority === 'TINGGI'
                                                ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-2xs ring-1 ring-rose-200'
                                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                        }`}
                                    >
                                        <Flame size={13} className={planForm.priority === 'TINGGI' ? 'fill-rose-500 text-rose-500' : 'text-slate-400'} />
                                        Tinggi (Mendesak)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPlanForm({ ...planForm, priority: 'SEDANG' })}
                                        className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border ${
                                            planForm.priority === 'SEDANG'
                                                ? 'bg-amber-50 border-amber-300 text-amber-800 shadow-2xs ring-1 ring-amber-200'
                                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                        }`}
                                    >
                                        <Zap size={13} className={planForm.priority === 'SEDANG' ? 'text-amber-500' : 'text-slate-400'} />
                                        Sedang (Standar)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPlanForm({ ...planForm, priority: 'RENDAH' })}
                                        className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border ${
                                            planForm.priority === 'RENDAH'
                                                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-2xs ring-1 ring-emerald-200'
                                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                        }`}
                                    >
                                        <CheckCircle2 size={13} className={planForm.priority === 'RENDAH' ? 'text-emerald-500' : 'text-slate-400'} />
                                        Rendah (Rutin)
                                    </button>
                                </div>
                            </div>

                            {/* Info Kategori Divisi (Otomatis dari Posisi Akun) */}
                            <div className="p-3 bg-violet-50/70 border border-violet-100/90 rounded-2xl flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-violet-600 block">
                                        Kategori / Divisi Pengisi
                                    </span>
                                    <span className="text-xs font-black text-slate-800 truncate block">
                                        {planForm.position || user.position || userDivision || 'Staff Sarpras'}
                                    </span>
                                </div>
                                <span className="text-[10px] bg-white px-2.5 py-1 rounded-xl text-violet-700 font-bold border border-violet-200 shrink-0">
                                    Otomatis Sesuai Posisi
                                </span>
                            </div>

                            {/* 2. Tanggal Estimasi Selesai (Judul) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">
                                        Tanggal Mulai
                                    </label>
                                    <input
                                        required
                                        type="date"
                                        value={planForm.startDate}
                                        onChange={(e) => setPlanForm({ ...planForm, startDate: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-violet-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">
                                        3. Tanggal Estimasi Selesai <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        required
                                        type="date"
                                        value={planForm.endDate}
                                        min={planForm.startDate || dayjs().format('YYYY-MM-DD')}
                                        onChange={(e) => handleMainEndDateChange(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-violet-700 outline-none focus:bg-white focus:border-violet-500"
                                    />
                                </div>
                            </div>

                            {/* 3. Point-Point Langkah Rencana (Opsional) */}
                            <div className="space-y-2 pt-1 border-t border-slate-100">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <label className="text-xs font-bold text-slate-700 block">
                                            2. Point-Point Langkah Rencana
                                        </label>
                                        <p className="text-[10px] text-slate-400 font-medium">
                                            Opsional. Tanggal estimasi langkah dibatasi maksimal tanggal estimasi judul.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleAddItemField}
                                        className="px-3 py-1 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                                    >
                                        <Plus size={13} /> Tambah Langkah
                                    </button>
                                </div>

                                {planForm.items.length === 0 ? (
                                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center space-y-1">
                                        <p className="text-xs font-semibold text-slate-500">
                                            Belum ada point langkah ditambahkan (Rencana Mandiri).
                                        </p>
                                        <p className="text-[11px] text-slate-400">
                                            Gunakan tombol <span className="font-bold text-violet-600">"✨ AI Rinci Langkah Otomatis"</span> atau klik <span className="font-bold text-violet-600">"+ Tambah Langkah"</span> di atas.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                                        {planForm.items.map((it, idx) => (
                                            <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-5 text-center text-xs font-black text-violet-600 shrink-0">
                                                        {idx + 1}.
                                                    </span>
                                                    <input
                                                        type="text"
                                                        required
                                                        placeholder={`Contoh langkah ke-${idx + 1}...`}
                                                        value={it.activity}
                                                        onChange={(e) => handleItemChange(idx, 'activity', e.target.value)}
                                                        className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-violet-500"
                                                    />
                                                    <button
                                                        type="button"
                                                        disabled={polishingPlanItemIdx === idx || !it.activity?.trim()}
                                                        onClick={() => handlePolishPlanItem(idx)}
                                                        className="px-2 py-1 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-lg text-[10px] font-bold flex items-center gap-1 transition cursor-pointer disabled:opacity-40 shrink-0"
                                                        title="Rapikan kalimat langkah ini dengan AI"
                                                    >
                                                        {polishingPlanItemIdx === idx ? (
                                                            <RotateCcw size={10} className="animate-spin text-violet-600" />
                                                        ) : (
                                                            <Sparkles size={10} className="text-violet-600" />
                                                        )}
                                                        <span>Rapikan</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveItemField(idx)}
                                                        className="p-1.5 text-slate-300 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                                                        title="Hapus langkah ini"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>

                                                {/* Step Target Date */}
                                                <div className="flex items-center justify-between pl-7 pr-1">
                                                    <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                                                        <Calendar size={12} className="text-violet-500" /> Estimasi Tanggal Langkah:
                                                    </label>
                                                    <input
                                                        type="date"
                                                        value={it.targetDate || ''}
                                                        min={planForm.startDate || dayjs().format('YYYY-MM-DD')}
                                                        max={planForm.endDate}
                                                        onChange={(e) => handleItemChange(idx, 'targetDate', e.target.value)}
                                                        className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:border-violet-500"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* 4. Deskripsi / Catatan Tambahan */}
                            <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1">
                                    Deskripsi / Catatan Tambahan (Opsional)
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="Sasaran capaian atau catatan teknis yang diantisipasi..."
                                    value={planForm.notes}
                                    onChange={(e) => setPlanForm({ ...planForm, notes: e.target.value })}
                                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:bg-white focus:border-violet-500"
                                />
                            </div>

                            {/* Footer Submit Buttons */}
                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowFormModal(false)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition cursor-pointer"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-violet-600/20 active:scale-95 cursor-pointer disabled:opacity-50"
                                >
                                    {saving ? 'Menyimpan...' : (editingPlan ? 'Perbarui Rencana' : 'Simpan Rencana')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 5. MODAL: SELESAIKAN 100% & BUKTI FOTO & HUBUNGKAN KE LAPORAN HARIAN */}
            {completionModal.isOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden flex flex-col my-8">
                        {/* Modal Header */}
                        <div className="p-5 sm:p-6 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shadow-inner">
                                    <CheckCircle2 size={22} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="text-base sm:text-lg font-black tracking-tight">
                                        Selesaikan Target 100%
                                    </h3>
                                    <p className="text-emerald-100 text-xs font-medium">
                                        Bukti foto pelaksanaan & hubungkan ke Laporan Harian
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                disabled={uploadingCompletion}
                                onClick={() => {
                                    handleRemoveCompletionPhoto();
                                    setCompletionModal(prev => ({ ...prev, isOpen: false }));
                                }}
                                className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-xl transition cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSubmitCompletion} className="p-5 sm:p-6 space-y-4">
                            {/* Task Preview Card */}
                            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5">
                                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                    <span>Target yang Diselesaikan</span>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700">
                                        {completionModal.plan?.metadata?.categoryTag || completionModal.plan?.category || 'UMUM'}
                                    </span>
                                </div>
                                <h4 className="text-sm font-black text-slate-800">
                                    {completionModal.plan?.metadata?.title || 'Rencana Kerja'}
                                </h4>
                                {completionModal.item && (
                                    <div className="flex items-start gap-2 pt-1 border-t border-slate-200/60 text-xs text-slate-600">
                                        <ArrowRight size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                                        <span className="font-semibold">{completionModal.item.activity || completionModal.item.text}</span>
                                    </div>
                                )}
                            </div>

                            {/* Photo Upload (Optional) */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                                        <Camera size={14} className="text-violet-600" />
                                        Bukti Foto Pelaksanaan
                                    </label>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                                        Opsional
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-400">
                                    Sertakan foto bukti hasil kegiatan jika ada.
                                </p>

                                <input
                                    type="file"
                                    ref={completionFileInputRef}
                                    accept="image/*"
                                    onChange={handleCompletionPhotoSelect}
                                    className="hidden"
                                />

                                {completionModal.photoPreview ? (
                                    <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 aspect-video max-h-48 flex items-center justify-center group">
                                        <img
                                            src={completionModal.photoPreview}
                                            alt="Preview Bukti Foto"
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => completionFileInputRef.current?.click()}
                                                className="px-3 py-1.5 bg-white text-slate-800 text-xs font-bold rounded-xl shadow cursor-pointer hover:bg-slate-100"
                                            >
                                                Ganti Foto
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleRemoveCompletionPhoto}
                                                className="p-1.5 bg-rose-600 text-white rounded-xl shadow cursor-pointer hover:bg-rose-700"
                                                title="Hapus Foto"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleRemoveCompletionPhoto}
                                            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center shadow hover:bg-rose-700 cursor-pointer"
                                        >
                                            <X size={13} strokeWidth={2.5} />
                                        </button>
                                    </div>
                                ) : (
                                    <div
                                        onClick={() => completionFileInputRef.current?.click()}
                                        className="border-2 border-dashed border-slate-200 hover:border-violet-400 bg-slate-50/70 hover:bg-violet-50/30 rounded-2xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group"
                                    >
                                        <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 shadow-2xs text-slate-400 group-hover:text-violet-600 group-hover:border-violet-200 flex items-center justify-center transition-all">
                                            <Upload size={18} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-700 group-hover:text-violet-700">
                                                Klik untuk Ambil / Pilih Foto
                                            </p>
                                            <p className="text-[10px] text-slate-400 mt-0.5">
                                                Mendukung kamera HP/laptop • JPG, PNG, WebP (Maks 15MB)
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Link to Daily Report Section */}
                            <div className="p-3.5 bg-violet-50/60 rounded-2xl border border-violet-100 space-y-3">
                                <label className="flex items-start gap-2.5 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={completionModal.syncToDailyReport}
                                        onChange={(e) => setCompletionModal(prev => ({ ...prev, syncToDailyReport: e.target.checked }))}
                                        className="mt-0.5 w-4 h-4 rounded text-violet-600 focus:ring-violet-500 border-slate-300 cursor-pointer"
                                    />
                                    <div className="text-xs">
                                        <span className="font-black text-violet-900 block">
                                            Langsung masukkan ke Laporan Harian hari ini
                                        </span>
                                        <span className="text-[11px] text-violet-600 font-medium">
                                            Kegiatan ini akan dicatat tuntas 100% beserta bukti foto di Laporan Harian Anda.
                                        </span>
                                    </div>
                                </label>

                                {completionModal.syncToDailyReport && (
                                    <div className="pt-2 border-t border-violet-100/80 space-y-1.5">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-violet-700 block">
                                            Pilih Sesi Laporan Harian:
                                        </span>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setCompletionModal(prev => ({ ...prev, sessionPeriod: 'morning' }))}
                                                className={`p-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border ${
                                                    completionModal.sessionPeriod === 'morning'
                                                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                                }`}
                                            >
                                                ☀️ Sesi Pagi (08:00 - 12:00)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setCompletionModal(prev => ({ ...prev, sessionPeriod: 'afternoon' }))}
                                                className={`p-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border ${
                                                    completionModal.sessionPeriod === 'afternoon'
                                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                                }`}
                                            >
                                                🌤️ Sesi Siang (13:00 - 16:30)
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer Actions */}
                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    disabled={uploadingCompletion}
                                    onClick={() => {
                                        handleRemoveCompletionPhoto();
                                        setCompletionModal(prev => ({ ...prev, isOpen: false }));
                                    }}
                                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={uploadingCompletion}
                                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 cursor-pointer disabled:opacity-50"
                                >
                                    {uploadingCompletion ? (
                                        <>
                                            <Loader2 size={15} className="animate-spin" />
                                            <span>Menyimpan & Mengunggah...</span>
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 size={15} />
                                            <span>Simpan & Selesaikan 100%</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 6. LIGHTBOX MODAL FOR VIEWING PHOTO PROOF */}
            {lightboxPhoto && (
                <LightboxModal
                    photoUrl={lightboxPhoto}
                    onClose={() => setLightboxPhoto(null)}
                />
            )}

            {/* 7. EXPORT WORK PLAN MODAL */}
            {showExportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col border border-slate-100 animate-in zoom-in-95">
                        {/* Header */}
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-violet-50 to-indigo-50">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-violet-600 text-white rounded-2xl shadow-md shadow-violet-500/20">
                                    <FileSpreadsheet size={20} />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-800 text-base">Ekspor Laporan Rencana Kerja</h3>
                                    <p className="text-xs text-slate-500 font-medium">Unduh dokumen PDF resmi atau file Excel berdasarkan rentang tanggal</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowExportModal(false)}
                                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-white/80 transition cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-5 overflow-y-auto max-h-[80vh]">
                            {/* Preset Buttons */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">Pilih Rentang Cepat:</label>
                                <div className="flex flex-wrap gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setExportStartDate(dayjs().startOf('month').format('YYYY-MM-DD'));
                                            setExportEndDate(dayjs().endOf('month').format('YYYY-MM-DD'));
                                        }}
                                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-violet-100 hover:text-violet-700 text-slate-700 transition cursor-pointer"
                                    >
                                        Bulan Ini
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setExportStartDate(dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD'));
                                            setExportEndDate(dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD'));
                                        }}
                                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-violet-100 hover:text-violet-700 text-slate-700 transition cursor-pointer"
                                    >
                                        Bulan Lalu
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setExportStartDate(dayjs().startOf('week').add(1, 'day').format('YYYY-MM-DD'));
                                            setExportEndDate(dayjs().startOf('week').add(6, 'day').format('YYYY-MM-DD'));
                                        }}
                                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-violet-100 hover:text-violet-700 text-slate-700 transition cursor-pointer"
                                    >
                                        Minggu Ini
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setExportStartDate(dayjs().startOf('year').format('YYYY-MM-DD'));
                                            setExportEndDate(dayjs().endOf('year').format('YYYY-MM-DD'));
                                        }}
                                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-violet-100 hover:text-violet-700 text-slate-700 transition cursor-pointer"
                                    >
                                        Tahun {dayjs().year()}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setExportStartDate('');
                                            setExportEndDate('');
                                        }}
                                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-violet-100 hover:text-violet-700 text-slate-700 transition cursor-pointer"
                                    >
                                        Semua Periode
                                    </button>
                                </div>
                            </div>

                            {/* Date Inputs */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-black text-slate-700 block mb-1">Dari Tanggal:</label>
                                    <input
                                        type="date"
                                        value={exportStartDate}
                                        onChange={(e) => setExportStartDate(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-violet-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-black text-slate-700 block mb-1">Sampai Tanggal:</label>
                                    <input
                                        type="date"
                                        value={exportEndDate}
                                        onChange={(e) => setExportEndDate(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-violet-500 outline-none"
                                    />
                                </div>
                            </div>

                            {/* Filters Row */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 block mb-1">Status</label>
                                    <select
                                        value={exportStatus}
                                        onChange={(e) => setExportStatus(e.target.value)}
                                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-white outline-none"
                                    >
                                        <option value="ALL">Semua Status</option>
                                        <option value="ACTIVE">Aktif (Sedang Berjalan)</option>
                                        <option value="DONE">Selesai 100%</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 block mb-1">Prioritas</label>
                                    <select
                                        value={exportPriority}
                                        onChange={(e) => setExportPriority(e.target.value)}
                                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-white outline-none"
                                    >
                                        <option value="ALL">Semua Prioritas</option>
                                        <option value="TINGGI">Tinggi</option>
                                        <option value="SEDANG">Sedang</option>
                                        <option value="RENDAH">Rendah</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 block mb-1">Kategori</label>
                                    <select
                                        value={exportCategory}
                                        onChange={(e) => setExportCategory(e.target.value)}
                                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-white outline-none"
                                    >
                                        <option value="ALL">Semua Kategori</option>
                                        {DIVISION_TAGS.map(t => (
                                            <option key={t.id} value={t.id}>{t.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Live Counter Preview */}
                            <div className="p-3.5 bg-violet-50/60 border border-violet-100 rounded-2xl flex items-center justify-between text-xs">
                                <div>
                                    <span className="font-black text-slate-800 block">Total Data Rencana Terfilter:</span>
                                    <span className="text-slate-500 text-[11px]">
                                        {exportStartDate || exportEndDate
                                            ? `${exportStartDate ? dayjs(exportStartDate).format('DD/MM/YYYY') : 'Awal'} s.d. ${exportEndDate ? dayjs(exportEndDate).format('DD/MM/YYYY') : 'Sekarang'}`
                                            : 'Semua Periode'}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className="text-lg font-black text-violet-700">{plansForExport.length}</span>
                                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Rencana Kerja</span>
                                </div>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
                            <button
                                type="button"
                                onClick={() => setShowExportModal(false)}
                                className="px-4 py-2 text-slate-500 hover:text-slate-700 text-xs font-bold transition cursor-pointer"
                            >
                                Tutup
                            </button>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    disabled={plansForExport.length === 0}
                                    onClick={handleExportWorkPlanExcel}
                                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
                                >
                                    <FileSpreadsheet size={15} /> Unduh Excel
                                </button>
                                <button
                                    type="button"
                                    disabled={plansForExport.length === 0 || exportingPdf}
                                    onClick={handleExportWorkPlanPDF}
                                    className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-violet-600/20 disabled:opacity-50 cursor-pointer"
                                >
                                    {exportingPdf ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />}
                                    <span>Unduh PDF Resmi</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
