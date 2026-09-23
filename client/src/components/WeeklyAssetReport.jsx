import { useState, useEffect, useMemo } from 'react';
import {
    Box, ArrowLeftRight, Wrench, ClipboardCheck, Handshake, Trash2,
    Calendar, CalendarRange, Printer, RefreshCw, Eye, Download,
    CheckCircle2, AlertCircle, Clock, Search, ChevronRight, Layers,
    Loader2, FileText, BarChart2, TrendingUp, Building2, Activity,
    SlidersHorizontal, Sparkles, Copy, Check, ChevronDown, ChevronUp,
    Lightbulb, ShieldCheck, Zap
} from 'lucide-react';
import api from '../lib/axios';
import { cn } from '../lib/utils';

/* ── jsPDF + autoTable CDN loader ── */
function loadJsPDF() {
    return new Promise((resolve) => {
        if (window.jspdf) { resolve(window.jspdf.jsPDF); return; }
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        s.onload = () => {
            const s2 = document.createElement('script');
            s2.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
            s2.onload = () => resolve(window.jspdf.jsPDF);
            document.head.appendChild(s2);
        };
        document.head.appendChild(s);
    });
}

export default function WeeklyAssetReport({ currentUser }) {
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [data, setData] = useState(null);
    const [preset, setPreset] = useState('this_week'); // 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom'
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedUnit, setSelectedUnit] = useState('all');
    const [activeTab, setActiveTab] = useState('unit_summary'); // 'unit_summary' | 'statistics' | 'new_assets' | 'movements' | 'maintenance' | 'audit' | 'loans' | 'disposals'
    const [showPrintPreview, setShowPrintPreview] = useState(false);
    const [showIndividualAssetList, setShowIndividualAssetList] = useState(false);
    const [searchUnitKeyword, setSearchUnitKeyword] = useState('');

    // State Ringkasan AI
    const [aiSummary, setAiSummary] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState(null);
    const [showAiCard, setShowAiCard] = useState(true);
    const [copiedAi, setCopiedAi] = useState(false);

    // Hitung tanggal berdasarkan preset
    const calculatePresetDates = (selectedPreset) => {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

        if (selectedPreset === 'today') {
            const todayStr = toYMD(now);
            return { start: todayStr, end: todayStr };
        } else if (selectedPreset === 'yesterday') {
            const y = new Date(now);
            y.setDate(y.getDate() - 1);
            const yStr = toYMD(y);
            return { start: yStr, end: yStr };
        } else if (selectedPreset === 'this_week') {
            const day = now.getDay();
            const diffToMonday = now.getDate() - (day === 0 ? 6 : day - 1);
            const monday = new Date(now.getFullYear(), now.getMonth(), diffToMonday);
            const sunday = new Date(now.getFullYear(), now.getMonth(), diffToMonday + 6);
            return {
                start: toYMD(monday),
                end: toYMD(sunday)
            };
        } else if (selectedPreset === 'last_week') {
            const day = now.getDay();
            const diffToLastMonday = now.getDate() - (day === 0 ? 6 : day - 1) - 7;
            const monday = new Date(now.getFullYear(), now.getMonth(), diffToLastMonday);
            const sunday = new Date(now.getFullYear(), now.getMonth(), diffToLastMonday + 6);
            return {
                start: toYMD(monday),
                end: toYMD(sunday)
            };
        } else if (selectedPreset === 'this_month') {
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            return {
                start: toYMD(firstDay),
                end: toYMD(lastDay)
            };
        } else if (selectedPreset === 'last_month') {
            const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
            return {
                start: toYMD(firstDay),
                end: toYMD(lastDay)
            };
        }
        return { start: startDate, end: endDate };
    };

    // Saat mount, inisialisasi dengan Minggu Ini
    useEffect(() => {
        const { start, end } = calculatePresetDates('this_week');
        setStartDate(start);
        setEndDate(end);
    }, []);

    // Fetch data setiap kali startDate, endDate, atau selectedUnit berubah
    useEffect(() => {
        if (startDate && endDate) {
            fetchReport();
        }
    }, [startDate, endDate, selectedUnit]);

    const fetchReport = async () => {
        try {
            setLoading(true);
            const params = {
                startDate,
                endDate
            };
            if (selectedUnit !== 'all') params.unitId = selectedUnit;

            const res = await api.get('/dashboard/weekly-report', { params });
            setData(res.data);
            fetchAiSummary(res.data);
        } catch (err) {
            console.error('Failed to load weekly asset report:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchAiSummary = async (overrideData = null) => {
        try {
            setAiLoading(true);
            setAiError(null);
            const activeData = overrideData || data;
            const payload = {
                startDate,
                endDate,
                unitId: selectedUnit !== 'all' ? selectedUnit : undefined,
                summary: activeData?.summary,
                statistics: activeData?.statistics,
                details: activeData?.details,
                unitSummary: activeData?.unitSummary,
                period: activeData?.period,
                unit: activeData?.unit
            };

            const res = await api.post('/dashboard/weekly-report/ai-summary', payload);
            if (res.data?.success) {
                setAiSummary(res.data.data);
            }
        } catch (err) {
            console.error('Failed to load AI summary for weekly asset report:', err);
            setAiError(err.response?.data?.error || err.message || 'Gagal memuat ringkasan AI');
        } finally {
            setAiLoading(false);
        }
    };

    const handleCopyAiSummary = () => {
        if (!aiSummary) return;
        const periodStr = data?.period?.formattedPeriod || `${startDate} s/d ${endDate}`;
        const unitStr = data?.unit || (selectedUnit === 'all' ? 'Seluruh Unit' : 'Unit Terpilih');
        
        let text = `*RINGKASAN EKSEKUTIF MANAJEMEN ASET (AI)*\n`;
        text += `*Periode:* ${periodStr}\n`;
        text += `*Unit:* ${unitStr}\n`;
        text += `*Status Operasional:* ${aiSummary.operationalStatusLabel || aiSummary.operationalStatus || 'Operasional Terpantau'}\n\n`;
        text += `*Ringkasan Naratif:*\n${aiSummary.narrativeSummary || '-'}\n\n`;
        
        if (aiSummary.keyHighlights && aiSummary.keyHighlights.length > 0) {
            text += `*Sorotan Kegiatan Utama:*\n`;
            aiSummary.keyHighlights.forEach((h, idx) => {
                text += `${idx + 1}. ${h}\n`;
            });
            text += `\n`;
        }
        
        if (aiSummary.strategicRecommendations && aiSummary.strategicRecommendations.length > 0) {
            text += `*Rekomendasi Tindak Lanjut:*\n`;
            aiSummary.strategicRecommendations.forEach((r, idx) => {
                text += `• ${r}\n`;
            });
        }
        
        if (navigator?.clipboard?.writeText) {
            navigator.clipboard.writeText(text);
        } else {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand("copy");
            document.body.removeChild(textArea);
        }
        setCopiedAi(true);
        setTimeout(() => setCopiedAi(false), 2000);
    };

    const handlePresetChange = (newPreset) => {
        setPreset(newPreset);
        if (newPreset !== 'custom') {
            const { start, end } = calculatePresetDates(newPreset);
            setStartDate(start);
            setEndDate(end);
        }
    };

    const summary = data?.summary || {
        newAssetsCount: 0,
        newAssetsValue: 0,
        movementsCount: 0,
        maintenanceCount: 0,
        maintenanceCost: 0,
        auditCount: 0,
        loansCount: 0,
        disposalsCount: 0
    };

    const unitSummary = useMemo(() => {
        return (data?.unitSummary || []).map(u => ({
            ...u,
            newAssets: u.newAssetsCount ?? u.newAssets ?? 0,
            movements: u.movementsCount ?? u.movements ?? 0,
            maintenance: u.maintenancesCount ?? u.maintenance ?? 0,
            audit: u.auditCount ?? u.audit ?? 0,
            loans: u.loansCount ?? u.loans ?? 0,
            disposals: u.disposalsCount ?? u.disposals ?? 0,
            activeAssetsCount: u.totalAssets ?? u.activeAssetsCount ?? 0,
            totalAssets: u.totalAssets ?? u.activeAssetsCount ?? 0
        }));
    }, [data?.unitSummary]);

    const statistics = data?.statistics || {
        categoryDistribution: [],
        maintenance: { total: 0, completed: 0, inProgress: 0, pending: 0, rejected: 0, completionRate: 0 },
        audit: { total: 0, found: 0, missing: 0, accuracyRate: 0 },
        operational: { daysCount: 1, totalEvents: 0, avgDailyEvents: 0, mostActiveUnit: '-' },
        loans: { total: 0, borrowed: 0, returned: 0 }
    };

    const details = data?.details || {
        newAssets: [],
        movements: [],
        maintenances: [],
        auditItems: [],
        loans: [],
        disposals: []
    };

    // Rekapitulasi kuantitas pengadaan barang baru (Grouping nama barang & kategori - Fokus Kuantitas)
    const groupedNewAssets = useMemo(() => {
        const map = new Map();
        (details.newAssets || []).forEach(item => {
            const rawName = (item.name || 'Aset Tanpa Nama').trim();
            const categoryName = item.category?.name || '-';
            const unitName = item.unit?.name || '-';
            const key = `${rawName.toLowerCase()}___${categoryName.toLowerCase()}`;
            if (!map.has(key)) {
                map.set(key, {
                    name: rawName,
                    category: categoryName,
                    unit: unitName,
                    qty: 0,
                });
            }
            const g = map.get(key);
            g.qty += 1;
            if (unitName !== '-' && g.unit !== unitName && !g.unit.includes(unitName)) {
                g.unit = `${g.unit}, ${unitName}`;
            }
        });
        return Array.from(map.values()).sort((a, b) => b.qty - a.qty);
    }, [details.newAssets]);

    const handleExportPDF = async () => {
        if (!data) return;
        setExporting(true);
        try {
            const jsPDF = await loadJsPDF();
            const doc = new jsPDF('portrait', 'mm', 'a4');
            const pageW = doc.internal.pageSize.getWidth();
            const pageH = doc.internal.pageSize.getHeight();

            // 1. KOP SURAT RESMI
            doc.setFontSize(16);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text('BIDANG SARANA', pageW / 2, 16, { align: 'center' });

            doc.setFontSize(9);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(79, 70, 229); // Indigo 600
            doc.text('YAYASAN DAR EL-IMAN', pageW / 2, 22, { align: 'center' });

            doc.setFontSize(8);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(100, 116, 139);
            doc.text('Jl. Gunuang Juaro, Surau Gadang, Kec. Nanggalo, Kota Padang, Sumatera Barat', pageW / 2, 27, { align: 'center' });

            // Garis pemisah kop
            doc.setDrawColor(30, 41, 59);
            doc.setLineWidth(0.6);
            doc.line(14, 30, pageW - 14, 30);
            doc.setLineWidth(0.2);
            doc.line(14, 31, pageW - 14, 31);

            // 2. JUDUL LAPORAN DINAMIS
            let reportTitle = 'LAPORAN OPERASIONAL & PERGERAKAN ASET BERKALA';
            if (preset === 'today' || preset === 'yesterday') {
                reportTitle = 'LAPORAN OPERASIONAL & PERGERAKAN ASET HARIAN';
            } else if (preset === 'this_week' || preset === 'last_week') {
                reportTitle = 'LAPORAN OPERASIONAL & PERGERAKAN ASET MINGGUAN';
            } else if (preset === 'this_month' || preset === 'last_month') {
                reportTitle = 'LAPORAN OPERASIONAL & PERGERAKAN ASET BULANAN';
            }

            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text(reportTitle, pageW / 2, 38, { align: 'center' });

            doc.setFontSize(8.5);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(71, 85, 105);
            doc.text(`Periode: ${data?.period?.formattedPeriod || '-'}   |   Unit: ${data?.unit || 'Seluruh Unit'}`, pageW / 2, 43, { align: 'center' });

            let currentY = 48;

            // RINGKASAN EKSEKUTIF AI (JIKA TERSEDIA)
            if (aiSummary?.narrativeSummary) {
                doc.setFontSize(8.5);
                doc.setFont(undefined, 'bold');
                doc.setTextColor(79, 70, 229);
                doc.text(`Ringkasan Eksekutif Operasional Aset (${aiSummary.operationalStatusLabel || 'Analisis Cerdas AI'})`, 14, currentY);
                currentY += 3.5;

                doc.setFontSize(7.5);
                doc.setFont(undefined, 'normal');
                doc.setTextColor(51, 65, 85);
                const splitText = doc.splitTextToSize(aiSummary.narrativeSummary, pageW - 36);
                const textHeight = splitText.length * 3.5 + 4;

                doc.setFillColor(248, 250, 252);
                doc.setDrawColor(226, 232, 240);
                doc.roundedRect(14, currentY, pageW - 28, textHeight, 1.5, 1.5, 'FD');

                doc.setFillColor(79, 70, 229);
                doc.rect(14, currentY, 1.5, textHeight, 'F');

                doc.text(splitText, 18, currentY + 3.5);
                currentY += textHeight + 5;
            }

            // 3. TABEL I: RINGKASAN REKAPITULASI METRIK (FOKUS KUANTITAS - TANPA HARGA)
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text('I. Ringkasan Rekapitulasi Metrik Aset (Kuantitas)', 14, currentY);

            const summaryRows = [
                ['1', 'Aset Baru Masuk (Pengadaan / Registrasi)', `${summary.newAssetsCount} unit`, 'Registrasi sarana baru'],
                ['2', 'Mutasi & Perpindahan Ruangan/Unit', `${summary.movementsCount} transaksi`, 'Relokasi dan penataan sarana'],
                ['3', 'Pemeliharaan & Perbaikan Sarana', `${summary.maintenanceCount} tiket`, `${statistics.maintenance.completed} Selesai, ${statistics.maintenance.inProgress} Proses`],
                ['4', 'Audit & Verifikasi Fisik Aset Lapangan', `${summary.auditCount} item`, `${statistics.audit.found} Sesuai Fisik (${statistics.audit.accuracyRate}%)`],
                ['5', 'Peminjaman Aset Antar Unit / Luar', `${summary.loansCount} transaksi`, `${statistics.loans.borrowed} Sedang Dipinjam`],
                ['6', 'Usulan Penghapusan (Disposal / Rusak Berat)', `${summary.disposalsCount} item`, 'Usulan afkir / lelang barang'],
            ];

            doc.autoTable({
                startY: currentY + 3,
                head: [['No', 'Indikator Kinerja / Aktivitas', 'Jumlah (Qty)', 'Keterangan / Status Operasional']],
                body: summaryRows,
                theme: 'grid',
                headStyles: { fillColor: [79, 70, 229], fontSize: 8, fontStyle: 'bold', halign: 'center' },
                bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
                columnStyles: {
                    0: { cellWidth: 10, halign: 'center' },
                    1: { cellWidth: 80 },
                    2: { cellWidth: 32, halign: 'center', fontStyle: 'bold' },
                    3: { cellWidth: 60, halign: 'left' }
                },
                margin: { left: 14, right: 14 }
            });

            currentY = doc.lastAutoTable.finalY + 7;

            // 4. TABEL II: ANALISIS STATISTIK & KINERJA OPERASIONAL ASET
            if (currentY > pageH - 55) {
                doc.addPage();
                currentY = 16;
            }

            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text('II. Analisis Statistik & Kinerja Operasional Aset', 14, currentY);

            const statRows = [
                ['1', 'Tingkat Ketercapaian Servis Pemeliharaan', `${statistics.maintenance.completionRate}%`, `${statistics.maintenance.completed} tiket selesai dari ${statistics.maintenance.total} total usulan`],
                ['2', 'Akurasi Hasil Verifikasi Audit Fisik', `${statistics.audit.accuracyRate}%`, `${statistics.audit.found} item sesuai dari ${statistics.audit.total} item diverifikasi`],
                ['3', 'Rata-rata Frekuensi Aktivitas Harian', `${statistics.operational.avgDailyEvents} aktivitas/hari`, `Total ${statistics.operational.totalEvents} transaksi selama ${statistics.operational.daysCount} hari`],
                ['4', 'Satker / Unit Paling Aktif Operasional', statistics.operational.mostActiveUnit, 'Unit dengan volume aktivitas sarana tertinggi di periode ini']
            ];

            doc.autoTable({
                startY: currentY + 3,
                head: [['No', 'Parameter Analisis Statistik', 'Nilai / Rasio', 'Catatan Evaluasi Kinerja']],
                body: statRows,
                theme: 'grid',
                headStyles: { fillColor: [16, 185, 129], fontSize: 8, fontStyle: 'bold', halign: 'center' },
                bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
                columnStyles: {
                    0: { cellWidth: 10, halign: 'center' },
                    1: { cellWidth: 80 },
                    2: { cellWidth: 32, halign: 'center', fontStyle: 'bold' },
                    3: { cellWidth: 60, halign: 'left' }
                },
                margin: { left: 14, right: 14 }
            });

            currentY = doc.lastAutoTable.finalY + 7;

            // Sub-analisis: Top Kategori Pengadaan
            if (statistics.categoryDistribution && statistics.categoryDistribution.length > 0) {
                if (currentY > pageH - 45) {
                    doc.addPage();
                    currentY = 16;
                }

                doc.setFontSize(8.5);
                doc.setFont(undefined, 'bold');
                doc.setTextColor(51, 65, 85);
                doc.text('Komposisi Kategori Dominan Aset Baru Masuk:', 14, currentY);

                const topCatRows = statistics.categoryDistribution.slice(0, 5).map((cat, idx) => [
                    idx + 1,
                    cat.name,
                    `${cat.count} unit`,
                    `${cat.percentage}%`
                ]);

                doc.autoTable({
                    startY: currentY + 2,
                    head: [['No', 'Kategori Aset', 'Jumlah (Qty)', 'Pangsa (%)']],
                    body: topCatRows,
                    theme: 'striped',
                    headStyles: { fillColor: [51, 65, 85], fontSize: 7.5, fontStyle: 'bold', halign: 'center' },
                    bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
                    columnStyles: {
                        0: { cellWidth: 10, halign: 'center' },
                        1: { cellWidth: 90 },
                        2: { cellWidth: 40, halign: 'center', fontStyle: 'bold' },
                        3: { cellWidth: 42, halign: 'center' }
                    },
                    margin: { left: 14, right: 14 }
                });

                currentY = doc.lastAutoTable.finalY + 7;
            }

            // 5. TABEL III: RINGKASAN SEBARAN & AKTIVITAS PER UNIT
            if (unitSummary.length > 0) {
                if (currentY > pageH - 60) {
                    doc.addPage();
                    currentY = 16;
                }

                doc.setFontSize(10);
                doc.setFont(undefined, 'bold');
                doc.setTextColor(30, 41, 59);
                doc.text('III. Ringkasan Aktivitas & Sebaran Aset per Unit', 14, currentY);

                const unitRows = unitSummary.map((u, idx) => [
                    idx + 1,
                    u.name,
                    u.code || '-',
                    `${u.newAssets || 0}`,
                    `${u.movements || 0}`,
                    `${u.maintenance || 0}`,
                    `${u.audit || 0}`,
                    `${u.loans || 0}`,
                    `${u.disposals || 0}`,
                    `${(u.activeAssetsCount || 0).toLocaleString('id-ID')}`
                ]);

                const totalAllUnitAssets = unitSummary.reduce((sum, u) => sum + (u.activeAssetsCount || 0), 0);

                doc.autoTable({
                    startY: currentY + 3,
                    head: [['No', 'Unit Kerja / Satker', 'Kode', 'Baru', 'Mutasi', 'Servis', 'Audit', 'Pinjam', 'Hapus', 'Total Aset']],
                    body: unitRows,
                    foot: [['', 'Total Akumulasi Seluruh Unit', '', `${summary.newAssetsCount}`, `${summary.movementsCount}`, `${summary.maintenanceCount}`, `${summary.auditCount}`, `${summary.loansCount}`, `${summary.disposalsCount}`, `${totalAllUnitAssets.toLocaleString('id-ID')}`]],
                    theme: 'striped',
                    headStyles: { fillColor: [30, 58, 138], fontSize: 7.5, fontStyle: 'bold', halign: 'center' },
                    bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
                    footStyles: { fillColor: [241, 245, 249], fontSize: 7.5, fontStyle: 'bold', textColor: [15, 23, 42] },
                    columnStyles: {
                        0: { cellWidth: 8, halign: 'center' },
                        1: { cellWidth: 56 },
                        2: { cellWidth: 18, halign: 'center' },
                        3: { cellWidth: 13, halign: 'center', fontStyle: 'bold' },
                        4: { cellWidth: 13, halign: 'center' },
                        5: { cellWidth: 13, halign: 'center' },
                        6: { cellWidth: 13, halign: 'center' },
                        7: { cellWidth: 13, halign: 'center' },
                        8: { cellWidth: 13, halign: 'center' },
                        9: { cellWidth: 18, halign: 'center', fontStyle: 'bold' }
                    },
                    margin: { left: 14, right: 14 }
                });

                currentY = doc.lastAutoTable.finalY + 7;
            }

            // 6. TABEL IV: REKAPITULASI KUANTITAS ASET BARU MASUK (PENGADAAN)
            if (groupedNewAssets.length > 0) {
                if (currentY > pageH - 50) {
                    doc.addPage();
                    currentY = 16;
                }

                doc.setFontSize(10);
                doc.setFont(undefined, 'bold');
                doc.setTextColor(30, 41, 59);
                doc.text('IV. Rekapitulasi Kuantitas Aset Baru Masuk (Pengadaan)', 14, currentY);

                const newAssetRows = groupedNewAssets.map((item, idx) => [
                    idx + 1,
                    item.name,
                    item.category,
                    item.unit,
                    `${item.qty} unit`
                ]);

                doc.autoTable({
                    startY: currentY + 3,
                    head: [['No', 'Nama Barang / Aset', 'Kategori', 'Unit Penerima', 'Jumlah (Qty)']],
                    body: newAssetRows,
                    foot: [['', `Total Pengadaan (${groupedNewAssets.length} Jenis Barang)`, '', '', `${summary.newAssetsCount} unit`]],
                    theme: 'striped',
                    headStyles: { fillColor: [51, 65, 85], fontSize: 7.5, fontStyle: 'bold', halign: 'center' },
                    bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
                    footStyles: { fillColor: [241, 245, 249], fontSize: 7.5, fontStyle: 'bold', textColor: [15, 23, 42] },
                    columnStyles: {
                        0: { cellWidth: 8, halign: 'center' },
                        1: { cellWidth: 72 },
                        2: { cellWidth: 42 },
                        3: { cellWidth: 35 },
                        4: { cellWidth: 25, halign: 'center', fontStyle: 'bold' }
                    },
                    margin: { left: 14, right: 14 }
                });

                currentY = doc.lastAutoTable.finalY + 7;
            }

            // 7. TABEL V: DAFTAR MUTASI (Jika ada)
            if (details.movements && details.movements.length > 0) {
                if (currentY > pageH - 45) {
                    doc.addPage();
                    currentY = 16;
                }

                doc.setFontSize(10);
                doc.setFont(undefined, 'bold');
                doc.setTextColor(30, 41, 59);
                doc.text('V. Daftar Mutasi & Perpindahan Aset', 14, currentY);

                const movementRows = details.movements.map((item, idx) => [
                    idx + 1,
                    item.asset?.name || '-',
                    item.fromLocation || '-',
                    item.toLocation || '-',
                    item.status || '-'
                ]);

                doc.autoTable({
                    startY: currentY + 3,
                    head: [['No', 'Nama Aset', 'Dari Lokasi', 'Menuju Lokasi', 'Status']],
                    body: movementRows,
                    theme: 'striped',
                    headStyles: { fillColor: [37, 99, 235], fontSize: 7.5, fontStyle: 'bold', halign: 'center' },
                    bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
                    columnStyles: {
                        0: { cellWidth: 8, halign: 'center' },
                        1: { cellWidth: 64 },
                        2: { cellWidth: 45 },
                        3: { cellWidth: 45 },
                        4: { cellWidth: 20, halign: 'center' }
                    },
                    margin: { left: 14, right: 14 }
                });

                currentY = doc.lastAutoTable.finalY + 7;
            }

            // 8. TABEL VI: DAFTAR PEMELIHARAAN (Jika ada - Tanpa Biaya)
            if (details.maintenances && details.maintenances.length > 0) {
                if (currentY > pageH - 45) {
                    doc.addPage();
                    currentY = 16;
                }

                doc.setFontSize(10);
                doc.setFont(undefined, 'bold');
                doc.setTextColor(30, 41, 59);
                doc.text('VI. Daftar Pemeliharaan & Servis Sarana', 14, currentY);

                const maintRows = details.maintenances.map((item, idx) => [
                    idx + 1,
                    item.title,
                    item.unit?.name || '-',
                    item.technician || '-',
                    item.status || '-'
                ]);

                doc.autoTable({
                    startY: currentY + 3,
                    head: [['No', 'Judul Pemeliharaan', 'Unit', 'Teknisi / Vendor', 'Status']],
                    body: maintRows,
                    theme: 'striped',
                    headStyles: { fillColor: [249, 115, 22], fontSize: 7.5, fontStyle: 'bold', halign: 'center' },
                    bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
                    columnStyles: {
                        0: { cellWidth: 8, halign: 'center' },
                        1: { cellWidth: 80 },
                        2: { cellWidth: 40 },
                        3: { cellWidth: 32 },
                        4: { cellWidth: 22, halign: 'center', fontStyle: 'bold' }
                    },
                    margin: { left: 14, right: 14 }
                });

                currentY = doc.lastAutoTable.finalY + 7;
            }

            // 9. KOLOM TANDA TANGAN RESMI
            if (currentY > pageH - 48) {
                doc.addPage();
                currentY = 20;
            } else {
                currentY += 4;
            }

            const kabidName = data?.signers?.kabid?.name || 'Ravi Kurnia';
            const kabidPos = 'Kepala Bidang Sarana';
            const kabidNiy = data?.signers?.kabid?.niy || '-';
            const kabidX = pageW - 55;

            doc.setFontSize(9);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(71, 85, 105);
            doc.text('Mengetahui,', kabidX, currentY, { align: 'center' });

            doc.setFont(undefined, 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text(kabidPos, kabidX, currentY + 5, { align: 'center' });

            // Ruang Tanda Tangan
            doc.setTextColor(15, 23, 42);
            doc.setFontSize(9.5);
            doc.text(kabidName.toUpperCase(), kabidX, currentY + 28, { align: 'center' });

            doc.setFont(undefined, 'normal');
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text(`NIY: ${kabidNiy}`, kabidX, currentY + 33, { align: 'center' });

            // 10. FOOTER PENOMORAN HALAMAN
            const totalPages = doc.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                doc.setFontSize(7.5);
                doc.setTextColor(148, 163, 184);
                doc.text(`Halaman ${i} dari ${totalPages}  |  Sistem Informasi Manajemen Aset & Sarpras Yayasan Dar El-Iman`, pageW / 2, pageH - 8, { align: 'center' });
            }

            const dateSuffix = `${preset}_${startDate || 'awal'}_sd_${endDate || 'akhir'}`;
            doc.save(`Laporan_Aset_${dateSuffix}.pdf`);
        } catch (err) {
            console.error('Export Weekly PDF Error:', err);
            alert('Gagal mengekspor PDF laporan: ' + err.message);
        } finally {
            setExporting(false);
        }
    };

    const handlePrint = () => {
        setShowPrintPreview(true);
        setTimeout(() => {
            window.print();
        }, 300);
    };


    return (
        <div className="space-y-6">
            {/* 1. FILTER & ACTION TOOLBAR (SCREEN ONLY) */}
            <div className="print:hidden bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* PRESET BUTTONS */}
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Periode:</span>
                    <button
                        onClick={() => handlePresetChange('today')}
                        className={cn(
                            "px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                            preset === 'today'
                                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        )}
                    >
                        Hari Ini
                    </button>
                    <button
                        onClick={() => handlePresetChange('yesterday')}
                        className={cn(
                            "px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                            preset === 'yesterday'
                                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        )}
                    >
                        Kemarin
                    </button>
                    <button
                        onClick={() => handlePresetChange('this_week')}
                        className={cn(
                            "px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                            preset === 'this_week'
                                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        )}
                    >
                        Minggu Ini
                    </button>
                    <button
                        onClick={() => handlePresetChange('last_week')}
                        className={cn(
                            "px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                            preset === 'last_week'
                                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        )}
                    >
                        Minggu Lalu
                    </button>
                    <button
                        onClick={() => handlePresetChange('this_month')}
                        className={cn(
                            "px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                            preset === 'this_month'
                                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        )}
                    >
                        Bulan Ini
                    </button>
                    <button
                        onClick={() => handlePresetChange('last_month')}
                        className={cn(
                            "px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                            preset === 'last_month'
                                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        )}
                    >
                        Bulan Lalu
                    </button>
                    <button
                        onClick={() => handlePresetChange('custom')}
                        className={cn(
                            "px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                            preset === 'custom'
                                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        )}
                    >
                        Kustom
                    </button>
                </div>

                {/* DATE INPUTS & UNIT FILTER & ACTIONS */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                        <Calendar size={14} className="text-slate-400" />
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => { setStartDate(e.target.value); setPreset('custom'); }}
                            className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer"
                        />
                        <span className="text-xs text-slate-400">s/d</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => { setEndDate(e.target.value); setPreset('custom'); }}
                            className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer"
                        />
                    </div>

                    {data?.units && data.units.length > 0 && (
                        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                            <span className="text-xs font-bold text-slate-400 uppercase">Unit:</span>
                            <select
                                value={selectedUnit}
                                onChange={(e) => setSelectedUnit(e.target.value)}
                                className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer"
                            >
                                <option value="all">Semua Unit</option>
                                {data.units.map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <button
                        onClick={fetchReport}
                        disabled={loading}
                        className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-all"
                        title="Segarkan Data"
                    >
                        <RefreshCw size={16} className={cn(loading && "animate-spin text-indigo-600")} />
                    </button>

                    <button
                        onClick={() => setShowPrintPreview(!showPrintPreview)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all"
                    >
                        <Eye size={15} />
                        {showPrintPreview ? 'Tutup Preview' : 'Preview Cetak'}
                    </button>

                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white shadow-sm transition-all"
                        title="Cetak via Dialog Printer Browser"
                    >
                        <Printer size={15} />
                        Cetak Printer
                    </button>

                    <button
                        onClick={handleExportPDF}
                        disabled={exporting || loading}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 transition-all hover:scale-105 disabled:opacity-50"
                        title="Unduh Dokumen PDF Resmi (Fokus Kuantitas Tanpa Harga)"
                    >
                        {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                        {exporting ? 'Mengekspor PDF...' : 'Download PDF Resmi'}
                    </button>
                </div>
            </div>

            {/* 1.5. RINGKASAN EKSEKUTIF AI (GOOGLE GEMINI) - SCREEN ONLY */}
            <div className="print:hidden bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 rounded-3xl p-5 md:p-6 text-white shadow-xl border border-indigo-500/20 relative overflow-hidden transition-all">
                {/* Decorative background glow */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
                <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>

                {/* CARD HEADER */}
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
                    <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30">
                                <Sparkles size={14} className="animate-pulse text-amber-300" />
                                Ringkasan Eksekutif AI
                            </span>
                            {aiSummary?.operationalStatus && (
                                <span className={cn(
                                    "px-2.5 py-0.5 rounded-full text-[11px] font-bold border",
                                    aiSummary.operationalStatus === 'OPTIMAL'
                                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                        : aiSummary.operationalStatus === 'STABIL'
                                            ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                                            : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                                )}>
                                    ● {aiSummary.operationalStatusLabel || aiSummary.operationalStatus}
                                </span>
                            )}
                            <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                                • {data?.period?.formattedPeriod || (startDate && endDate ? `${startDate} s/d ${endDate}` : '-')}
                            </span>
                        </div>
                        <h3 className="text-lg md:text-xl font-black text-white tracking-tight flex items-center gap-2">
                            Rangkuman Operasional Sarana & Aset
                            <span className="text-xs font-normal text-indigo-200/80 px-2.5 py-0.5 rounded-md bg-white/10 border border-white/10">
                                {data?.unit || (selectedUnit === 'all' ? 'Seluruh Unit' : 'Unit Terpilih')}
                            </span>
                        </h3>
                    </div>

                    {/* ACTION BUTTONS */}
                    <div className="flex items-center gap-2 shrink-0">
                        {aiSummary && (
                            <button
                                type="button"
                                onClick={handleCopyAiSummary}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-slate-200 transition-all border border-white/15 cursor-pointer"
                                title="Salin ringkasan ke clipboard (format WhatsApp/Memo)"
                            >
                                {copiedAi ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                {copiedAi ? 'Tersalin!' : 'Salin Ringkasan'}
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={fetchAiSummary}
                            disabled={aiLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all border border-indigo-400/30 disabled:opacity-50 cursor-pointer"
                            title="Analisis Ulang AI sesuai tanggal terpilih"
                        >
                            <RefreshCw size={14} className={cn(aiLoading && "animate-spin text-amber-300")} />
                            {aiLoading ? 'Menganalisis...' : 'Analisis Ulang AI'}
                        </button>

                        <button
                            type="button"
                            onClick={() => setShowAiCard(!showAiCard)}
                            className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                            title={showAiCard ? 'Perkecil Tampilan' : 'Perbesar Tampilan'}
                        >
                            {showAiCard ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                    </div>
                </div>

                {/* CARD BODY (COLLAPSIBLE) */}
                {showAiCard && (
                    <div className="relative z-10 pt-4 space-y-4">
                        {aiLoading && !aiSummary ? (
                            <div className="py-8 flex flex-col items-center justify-center space-y-3">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-600/40 border border-indigo-400/30 flex items-center justify-center animate-pulse">
                                    <Sparkles size={24} className="text-amber-300 animate-spin" />
                                </div>
                                <div className="text-center space-y-1">
                                    <p className="text-sm font-bold text-white">Google Gemini AI sedang merangkum kegiatan aset...</p>
                                    <p className="text-xs text-slate-400">
                                        Menganalisis penambahan barang baru, mutasi, efisiensi servis, serta verifikasi audit periode {data?.period?.formattedPeriod || `${startDate} s/d ${endDate}`}.
                                    </p>
                                </div>
                            </div>
                        ) : aiError && !aiSummary ? (
                            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-200 text-xs flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <AlertCircle size={16} className="text-rose-400 shrink-0" />
                                    <span>{aiError}</span>
                                </div>
                                <button
                                    onClick={fetchAiSummary}
                                    className="px-3 py-1 rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-500 transition-all cursor-pointer"
                                >
                                    Coba Lagi
                                </button>
                            </div>
                        ) : aiSummary ? (
                            <>
                                {/* 1. NARASI EKSEKUTIF LENGKAP */}
                                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 relative overflow-hidden backdrop-blur-xs">
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-400 to-amber-400"></div>
                                    <p className="text-sm leading-relaxed text-slate-100 font-medium pl-2.5">
                                        {aiSummary.narrativeSummary}
                                    </p>
                                </div>

                                {/* 2. HIGHLIGHT KEGIATAN UTAMA (4 CARDS) */}
                                {aiSummary.keyHighlights && aiSummary.keyHighlights.length > 0 && (
                                    <div>
                                        <div className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                                            <Zap size={13} className="text-amber-400" />
                                            Sorotan Dinamika & Kegiatan Utama
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                            {aiSummary.keyHighlights.map((hl, idx) => (
                                                <div
                                                    key={idx}
                                                    className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-3 text-xs flex items-start gap-2.5 transition-all"
                                                >
                                                    <div className="w-5 h-5 rounded-full bg-indigo-500/30 text-indigo-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5 border border-indigo-400/30">
                                                        {idx + 1}
                                                    </div>
                                                    <span className="text-slate-200 leading-snug">{hl}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* 3. EVALUASI OPERASIONAL & REKOMENDASI STRATEGIS */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                                    {/* EVALUASI PILAR */}
                                    {aiSummary.operationalEvaluation && (
                                        <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 space-y-2">
                                            <div className="text-[11px] font-black uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                                                <ShieldCheck size={14} className="text-indigo-400" />
                                                Catatan Efisiensi & Kontrol
                                            </div>
                                            <div className="space-y-1.5 text-xs">
                                                {aiSummary.operationalEvaluation.procurementNote && (
                                                    <div className="text-slate-300">
                                                        <span className="font-bold text-slate-100">Pengadaan:</span> {aiSummary.operationalEvaluation.procurementNote}
                                                    </div>
                                                )}
                                                {aiSummary.operationalEvaluation.maintenanceEfficiency && (
                                                    <div className="text-slate-300">
                                                        <span className="font-bold text-slate-100">Pemeliharaan:</span> {aiSummary.operationalEvaluation.maintenanceEfficiency}
                                                    </div>
                                                )}
                                                {aiSummary.operationalEvaluation.assetControl && (
                                                    <div className="text-slate-300">
                                                        <span className="font-bold text-slate-100">Audit & Kontrol:</span> {aiSummary.operationalEvaluation.assetControl}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* REKOMENDASI TINDAK LANJUT */}
                                    {aiSummary.strategicRecommendations && aiSummary.strategicRecommendations.length > 0 && (
                                        <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 space-y-2">
                                            <div className="text-[11px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                                                <Lightbulb size={14} className="text-amber-400" />
                                                Rekomendasi Tindak Lanjut Strategis
                                            </div>
                                            <ul className="space-y-1.5 text-xs text-slate-300">
                                                {aiSummary.strategicRecommendations.map((rec, rIdx) => (
                                                    <li key={rIdx} className="flex items-start gap-2">
                                                        <span className="text-amber-400 font-bold mt-0.5">•</span>
                                                        <span className="leading-snug">{rec}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : null}
                    </div>
                )}
            </div>

            {/* 2. SUMMARY METRIC CARDS (SCREEN ONLY - ZERO PRICE, VOLUME FOCUS) */}
            <div className="print:hidden grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {/* CARD 1: ASET BARU */}
                <div
                    onClick={() => setActiveTab('new_assets')}
                    className={cn(
                        "p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group",
                        activeTab === 'new_assets'
                            ? "bg-indigo-50/70 border-indigo-300 shadow-md shadow-indigo-100 ring-2 ring-indigo-500/20"
                            : "bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm"
                    )}
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className="w-9 h-9 rounded-xl bg-indigo-500 text-white flex items-center justify-center shadow-sm">
                            <Box size={18} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-full">
                            Pengadaan
                        </span>
                    </div>
                    <div className="text-2xl font-black text-slate-800">{summary.newAssetsCount} <span className="text-xs font-semibold text-slate-400">Unit</span></div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Aset Baru Masuk</div>
                    <div className="text-[11px] font-semibold text-indigo-700 mt-2 truncate">
                        {groupedNewAssets.length} Jenis Barang
                    </div>
                </div>

                {/* CARD 2: MUTASI ASET */}
                <div
                    onClick={() => setActiveTab('movements')}
                    className={cn(
                        "p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group",
                        activeTab === 'movements'
                            ? "bg-blue-50/70 border-blue-300 shadow-md shadow-blue-100 ring-2 ring-blue-500/20"
                            : "bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm"
                    )}
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className="w-9 h-9 rounded-xl bg-blue-500 text-white flex items-center justify-center shadow-sm">
                            <ArrowLeftRight size={18} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-full">
                            Perpindahan
                        </span>
                    </div>
                    <div className="text-2xl font-black text-slate-800">{summary.movementsCount} <span className="text-xs font-semibold text-slate-400">Item</span></div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Mutasi Aset</div>
                    <div className="text-[11px] font-semibold text-slate-500 mt-2">
                        Relokasi ruangan/unit
                    </div>
                </div>

                {/* CARD 3: PEMELIHARAAN */}
                <div
                    onClick={() => setActiveTab('maintenance')}
                    className={cn(
                        "p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group",
                        activeTab === 'maintenance'
                            ? "bg-amber-50/70 border-amber-300 shadow-md shadow-amber-100 ring-2 ring-amber-500/20"
                            : "bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm"
                    )}
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
                            <Wrench size={18} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-full">
                            Perbaikan
                        </span>
                    </div>
                    <div className="text-2xl font-black text-slate-800">{summary.maintenanceCount} <span className="text-xs font-semibold text-slate-400">Tiket</span></div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Pemeliharaan</div>
                    <div className="text-[11px] font-bold text-amber-700 mt-2 truncate">
                        {statistics.maintenance.completed} Selesai ({statistics.maintenance.completionRate}%)
                    </div>
                </div>

                {/* CARD 4: AUDIT FISIK */}
                <div
                    onClick={() => setActiveTab('audit')}
                    className={cn(
                        "p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group",
                        activeTab === 'audit'
                            ? "bg-emerald-50/70 border-emerald-300 shadow-md shadow-emerald-100 ring-2 ring-emerald-500/20"
                            : "bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm"
                    )}
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                            <ClipboardCheck size={18} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                            Verifikasi
                        </span>
                    </div>
                    <div className="text-2xl font-black text-slate-800">{summary.auditCount} <span className="text-xs font-semibold text-slate-400">Item</span></div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Audit / Cek Fisik</div>
                    <div className="text-[11px] font-bold text-emerald-700 mt-2">
                        {statistics.audit.accuracyRate}% Ditemukan
                    </div>
                </div>

                {/* CARD 5: PEMINJAMAN */}
                <div
                    onClick={() => setActiveTab('loans')}
                    className={cn(
                        "p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group",
                        activeTab === 'loans'
                            ? "bg-violet-50/70 border-violet-300 shadow-md shadow-violet-100 ring-2 ring-violet-500/20"
                            : "bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm"
                    )}
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className="w-9 h-9 rounded-xl bg-violet-500 text-white flex items-center justify-center shadow-sm">
                            <Handshake size={18} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-violet-700 bg-violet-100/70 px-2 py-0.5 rounded-full">
                            Peminjaman
                        </span>
                    </div>
                    <div className="text-2xl font-black text-slate-800">{summary.loansCount} <span className="text-xs font-semibold text-slate-400">Sesi</span></div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Peminjaman Aset</div>
                    <div className="text-[11px] font-semibold text-violet-700 mt-2">
                        {statistics.loans.borrowed} Aktif Dipinjam
                    </div>
                </div>

                {/* CARD 6: USULAN PENGHAPUSAN */}
                <div
                    onClick={() => setActiveTab('disposals')}
                    className={cn(
                        "p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group",
                        activeTab === 'disposals'
                            ? "bg-rose-50/70 border-rose-300 shadow-md shadow-rose-100 ring-2 ring-rose-500/20"
                            : "bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm"
                    )}
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className="w-9 h-9 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow-sm">
                            <Trash2 size={18} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 bg-rose-100/70 px-2 py-0.5 rounded-full">
                            Disposal
                        </span>
                    </div>
                    <div className="text-2xl font-black text-slate-800">{summary.disposalsCount} <span className="text-xs font-semibold text-slate-400">Usulan</span></div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Penghapusan Aset</div>
                    <div className="text-[11px] font-semibold text-slate-500 mt-2">
                        Rusak berat / lelang
                    </div>
                </div>
            </div>

            {/* 3. ACTIVITY DETAILS TABS & TABLES (SCREEN ONLY) */}
            <div className="print:hidden bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {/* SUB-TABS HEADER */}
                <div className="flex flex-wrap items-center gap-1.5 p-3 bg-slate-50/80 border-b border-slate-100">
                    <button
                        onClick={() => setActiveTab('unit_summary')}
                        className={cn(
                            "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all",
                            activeTab === 'unit_summary'
                                ? "bg-white text-indigo-700 shadow-sm border border-indigo-100"
                                : "text-slate-500 hover:text-slate-800"
                        )}
                    >
                        <Building2 size={14} />
                        Ringkasan per Unit ({unitSummary.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('statistics')}
                        className={cn(
                            "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all",
                            activeTab === 'statistics'
                                ? "bg-white text-indigo-700 shadow-sm border border-indigo-100"
                                : "text-slate-500 hover:text-slate-800"
                        )}
                    >
                        <BarChart2 size={14} />
                        Analisis Statistik
                    </button>
                    <button
                        onClick={() => setActiveTab('new_assets')}
                        className={cn(
                            "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all",
                            activeTab === 'new_assets'
                                ? "bg-white text-indigo-700 shadow-sm border border-indigo-100"
                                : "text-slate-500 hover:text-slate-800"
                        )}
                    >
                        <Box size={14} />
                        Aset Baru ({details.newAssets.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('movements')}
                        className={cn(
                            "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all",
                            activeTab === 'movements'
                                ? "bg-white text-blue-700 shadow-sm border border-blue-100"
                                : "text-slate-500 hover:text-slate-800"
                        )}
                    >
                        <ArrowLeftRight size={14} />
                        Mutasi ({details.movements.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('maintenance')}
                        className={cn(
                            "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all",
                            activeTab === 'maintenance'
                                ? "bg-white text-amber-700 shadow-sm border border-amber-100"
                                : "text-slate-500 hover:text-slate-800"
                        )}
                    >
                        <Wrench size={14} />
                        Pemeliharaan ({details.maintenances.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('audit')}
                        className={cn(
                            "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all",
                            activeTab === 'audit'
                                ? "bg-white text-emerald-700 shadow-sm border border-emerald-100"
                                : "text-slate-500 hover:text-slate-800"
                        )}
                    >
                        <ClipboardCheck size={14} />
                        Audit Fisik ({details.auditItems.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('loans')}
                        className={cn(
                            "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all",
                            activeTab === 'loans'
                                ? "bg-white text-violet-700 shadow-sm border border-violet-100"
                                : "text-slate-500 hover:text-slate-800"
                        )}
                    >
                        <Handshake size={14} />
                        Peminjaman ({details.loans.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('disposals')}
                        className={cn(
                            "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all",
                            activeTab === 'disposals'
                                ? "bg-white text-rose-700 shadow-sm border border-rose-100"
                                : "text-slate-500 hover:text-slate-800"
                        )}
                    >
                        <Trash2 size={14} />
                        Disposal ({details.disposals.length})
                    </button>
                </div>

                {/* TAB CONTENT: RINGKASAN PER UNIT */}
                {activeTab === 'unit_summary' && (
                    <div className="space-y-4 p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                                    <Building2 size={15} className="text-indigo-600" />
                                    Matriks Rekapitulasi Aktivitas per Unit / Satker
                                </h4>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    Distribusi aktivitas fisik aset di seluruh unit kerja pada periode terpilih
                                </p>
                            </div>
                            <div className="w-full sm:w-64">
                                <input
                                    type="text"
                                    placeholder="Cari nama unit..."
                                    value={searchUnitKeyword}
                                    onChange={(e) => setSearchUnitKeyword(e.target.value)}
                                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-500"
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-slate-100">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider">
                                    <tr>
                                        <th className="px-4 py-3 text-center w-12">No</th>
                                        <th className="px-4 py-3">Nama Satuan Kerja / Unit</th>
                                        <th className="px-4 py-3 text-center text-indigo-700">Aset Baru</th>
                                        <th className="px-4 py-3 text-center text-blue-700">Mutasi</th>
                                        <th className="px-4 py-3 text-center text-amber-700">Perbaikan</th>
                                        <th className="px-4 py-3 text-center text-emerald-700">Cek Fisik</th>
                                        <th className="px-4 py-3 text-center text-violet-700">Pinjam</th>
                                        <th className="px-4 py-3 text-center text-rose-700">Disposal</th>
                                        <th className="px-4 py-3 text-center font-black text-slate-900 bg-slate-100/50">Total Aset Aktif</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {unitSummary
                                        .filter(u => !searchUnitKeyword || u.name.toLowerCase().includes(searchUnitKeyword.toLowerCase()))
                                        .map((u, idx) => (
                                            <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                                                <td className="px-4 py-3 text-center text-slate-400 font-semibold">{idx + 1}</td>
                                                <td className="px-4 py-3 font-bold text-slate-800 text-sm">
                                                    {u.name}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={cn(
                                                        "px-2 py-0.5 rounded-full text-xs font-bold",
                                                        u.newAssets > 0 ? "bg-indigo-50 text-indigo-700 font-black" : "text-slate-400"
                                                    )}>
                                                        {u.newAssets}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={cn(
                                                        "px-2 py-0.5 rounded-full text-xs font-bold",
                                                        u.movements > 0 ? "bg-blue-50 text-blue-700 font-black" : "text-slate-400"
                                                    )}>
                                                        {u.movements}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={cn(
                                                        "px-2 py-0.5 rounded-full text-xs font-bold",
                                                        u.maintenance > 0 ? "bg-amber-50 text-amber-700 font-black" : "text-slate-400"
                                                    )}>
                                                        {u.maintenance}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={cn(
                                                        "px-2 py-0.5 rounded-full text-xs font-bold",
                                                        u.audit > 0 ? "bg-emerald-50 text-emerald-700 font-black" : "text-slate-400"
                                                    )}>
                                                        {u.audit}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={cn(
                                                        "px-2 py-0.5 rounded-full text-xs font-bold",
                                                        u.loans > 0 ? "bg-violet-50 text-violet-700 font-black" : "text-slate-400"
                                                    )}>
                                                        {u.loans}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={cn(
                                                        "px-2 py-0.5 rounded-full text-xs font-bold",
                                                        u.disposals > 0 ? "bg-rose-50 text-rose-700 font-black" : "text-slate-400"
                                                    )}>
                                                        {u.disposals}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center font-black text-slate-800 text-sm bg-slate-50/50">
                                                    {(u.activeAssetsCount || 0).toLocaleString('id-ID')} unit
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                                <tfoot className="bg-slate-100/80 font-black text-slate-800 border-t-2 border-slate-200">
                                    <tr>
                                        <td colSpan={2} className="px-4 py-3 text-right uppercase text-[11px]">
                                            Total Keseluruhan Unit
                                        </td>
                                        <td className="px-4 py-3 text-center text-indigo-700">{summary.newAssetsCount}</td>
                                        <td className="px-4 py-3 text-center text-blue-700">{summary.movementsCount}</td>
                                        <td className="px-4 py-3 text-center text-amber-700">{summary.maintenanceCount}</td>
                                        <td className="px-4 py-3 text-center text-emerald-700">{summary.auditCount}</td>
                                        <td className="px-4 py-3 text-center text-violet-700">{summary.loansCount}</td>
                                        <td className="px-4 py-3 text-center text-rose-700">{summary.disposalsCount}</td>
                                        <td className="px-4 py-3 text-center font-black text-slate-900 bg-slate-200/50">
                                            {unitSummary.reduce((acc, u) => acc + (u.activeAssetsCount || 0), 0).toLocaleString('id-ID')} unit
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                )}

                {/* TAB CONTENT: ANALISIS STATISTIK */}
                {activeTab === 'statistics' && (
                    <div className="space-y-6 p-4">
                        {/* KPI STATISTIK HIGHLIGHTS */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Tingkat Servis Selesai</span>
                                    <Wrench size={16} className="text-amber-600" />
                                </div>
                                <div className="text-3xl font-black text-amber-900">{statistics.maintenance.completionRate}%</div>
                                <p className="text-xs text-amber-700 mt-1">
                                    {statistics.maintenance.completed} dari {statistics.maintenance.total} tiket tuntas
                                </p>
                                <div className="w-full bg-amber-200 rounded-full h-1.5 mt-3">
                                    <div className="bg-amber-600 h-1.5 rounded-full" style={{ width: `${statistics.maintenance.completionRate}%` }}></div>
                                </div>
                            </div>

                            <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Akurasi Cek Fisik</span>
                                    <ClipboardCheck size={16} className="text-emerald-600" />
                                </div>
                                <div className="text-3xl font-black text-emerald-900">{statistics.audit.accuracyRate}%</div>
                                <p className="text-xs text-emerald-700 mt-1">
                                    {statistics.audit.found} terdata, {statistics.audit.missing} belum ditemukan
                                </p>
                                <div className="w-full bg-emerald-200 rounded-full h-1.5 mt-3">
                                    <div className="bg-emerald-600 h-1.5 rounded-full" style={{ width: `${statistics.audit.accuracyRate}%` }}></div>
                                </div>
                            </div>

                            <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100/50 border border-indigo-200">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider">Frekuensi Operasional</span>
                                    <Activity size={16} className="text-indigo-600" />
                                </div>
                                <div className="text-3xl font-black text-indigo-900">{statistics.operational.avgDailyEvents} <span className="text-sm font-semibold">/hari</span></div>
                                <p className="text-xs text-indigo-700 mt-1">
                                    Total {statistics.operational.totalEvents} transaksi ({statistics.operational.daysCount} hari periode)
                                </p>
                            </div>

                            <div className="p-4 rounded-xl bg-gradient-to-br from-violet-50 to-violet-100/50 border border-violet-200">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[11px] font-bold text-violet-800 uppercase tracking-wider">Unit Paling Aktif</span>
                                    <Building2 size={16} className="text-violet-600" />
                                </div>
                                <div className="text-lg font-black text-violet-900 truncate">{statistics.operational.mostActiveUnit}</div>
                                <p className="text-xs text-violet-700 mt-1">
                                    Aktivitas pergerakan & logistik tertinggi
                                </p>
                            </div>
                        </div>

                        {/* DISTRIBUSI KATEGORI ASET */}
                        <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-3 flex items-center gap-2">
                                <BarChart2 size={15} className="text-indigo-600" />
                                Sebaran Kategori Pengadaan Aset pada Periode Ini
                            </h4>
                            {statistics.categoryDistribution.length === 0 ? (
                                <p className="text-xs text-slate-400 font-semibold py-4 text-center">
                                    Belum ada penambahan aset baru pada periode ini.
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {statistics.categoryDistribution.map((cat, idx) => (
                                        <div key={idx} className="space-y-1">
                                            <div className="flex justify-between text-xs font-bold text-slate-700">
                                                <span>{cat.name}</span>
                                                <span>{cat.count} unit ({cat.percentage}%)</span>
                                            </div>
                                            <div className="w-full bg-slate-200 rounded-full h-2">
                                                <div
                                                    className="bg-indigo-600 h-2 rounded-full transition-all"
                                                    style={{ width: `${cat.percentage}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB CONTENT: NEW ASSETS (ZERO PRICE) */}
                {activeTab === 'new_assets' && (
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50/60 border-b border-slate-100">
                            <div>
                                <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                                    Rekapitulasi Kuantitas Pengadaan Aset ({groupedNewAssets.length} Jenis Barang)
                                </span>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    Total fisik terdata: <span className="font-bold text-indigo-600">{summary.newAssetsCount} unit aset</span>
                                </p>
                            </div>
                            <button
                                onClick={() => setShowIndividualAssetList(!showIndividualAssetList)}
                                className="text-xs font-bold px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-all self-start sm:self-auto shadow-sm"
                            >
                                {showIndividualAssetList ? 'Tampilkan Rekap Kuantitas Saja' : 'Lihat Rincian Kode Aset'}
                            </button>
                        </div>

                        {!showIndividualAssetList ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider">
                                        <tr>
                                            <th className="px-5 py-3.5 text-center w-12">No</th>
                                            <th className="px-5 py-3.5">Nama Barang / Aset</th>
                                            <th className="px-5 py-3.5">Kategori</th>
                                            <th className="px-5 py-3.5">Unit Penerima</th>
                                            <th className="px-5 py-3.5 text-center">Jumlah (Qty)</th>
                                            <th className="px-5 py-3.5 text-center">Status / Satuan</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {groupedNewAssets.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-5 py-8 text-center text-slate-400 font-semibold">
                                                    Tidak ada data aset baru masuk pada periode ini.
                                                </td>
                                            </tr>
                                        ) : (
                                            groupedNewAssets.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                                                    <td className="px-5 py-3.5 text-center text-slate-400 font-semibold">{idx + 1}</td>
                                                    <td className="px-5 py-3.5 font-bold text-slate-800 text-sm">
                                                        {item.name}
                                                    </td>
                                                    <td className="px-5 py-3.5 text-slate-600 font-medium">
                                                        {item.category}
                                                    </td>
                                                    <td className="px-5 py-3.5 text-slate-600">
                                                        {item.unit}
                                                    </td>
                                                    <td className="px-5 py-3.5 text-center">
                                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-100">
                                                            {item.qty} unit
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3.5 text-center">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                            Terdaftar
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider">
                                        <tr>
                                            <th className="px-5 py-3.5">Kode & Nama Aset</th>
                                            <th className="px-5 py-3.5">Kategori</th>
                                            <th className="px-5 py-3.5">Unit & Ruangan</th>
                                            <th className="px-5 py-3.5">Kondisi</th>
                                            <th className="px-5 py-3.5">Tgl Terdaftar</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {details.newAssets.map(item => (
                                            <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                                                <td className="px-5 py-3.5">
                                                    <div className="font-bold text-slate-800">{item.name}</div>
                                                    <div className="text-[10px] text-indigo-600 font-mono font-semibold">{item.code}</div>
                                                </td>
                                                <td className="px-5 py-3.5 text-slate-600 font-medium">
                                                    {item.category?.name || '-'}
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <div className="font-semibold text-slate-700">{item.unit?.name || '-'}</div>
                                                    <div className="text-[11px] text-slate-400">{item.room?.name || '-'}</div>
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <span className={cn(
                                                        "px-2 py-0.5 rounded-full text-[10px] font-black uppercase",
                                                        item.condition === 'BAIK' ? "bg-emerald-50 text-emerald-700" :
                                                        item.condition === 'RUSAK_RINGAN' ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
                                                    )}>
                                                        {item.condition}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3.5 text-slate-500">
                                                    {new Date(item.createdAt).toLocaleDateString('id-ID')}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* TAB CONTENT: MOVEMENTS */}
                {activeTab === 'movements' && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider">
                                <tr>
                                    <th className="px-5 py-3.5">Aset</th>
                                    <th className="px-5 py-3.5">Lokasi Asal</th>
                                    <th className="px-5 py-3.5">Lokasi Tujuan</th>
                                    <th className="px-5 py-3.5">Pemohon</th>
                                    <th className="px-5 py-3.5">Status</th>
                                    <th className="px-5 py-3.5">Tanggal</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {details.movements.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-5 py-8 text-center text-slate-400 font-semibold">
                                            Tidak ada aktivitas mutasi aset pada periode ini.
                                        </td>
                                    </tr>
                                ) : (
                                    details.movements.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="px-5 py-3.5">
                                                <div className="font-bold text-slate-800">{item.asset?.name}</div>
                                                <div className="text-[10px] text-blue-600 font-mono font-semibold">{item.asset?.code}</div>
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-600 font-medium">
                                                {item.fromLocation || '-'}
                                            </td>
                                            <td className="px-5 py-3.5 font-bold text-slate-700">
                                                {item.toLocation || '-'}
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-600">
                                                {item.requester?.name || '-'}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded-full text-[10px] font-black uppercase",
                                                    item.status === 'APPROVED' ? "bg-emerald-50 text-emerald-700" :
                                                    item.status === 'REJECTED' ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"
                                                )}>
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-500">
                                                {new Date(item.date).toLocaleDateString('id-ID')}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* TAB CONTENT: MAINTENANCE (ZERO PRICE) */}
                {activeTab === 'maintenance' && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider">
                                <tr>
                                    <th className="px-5 py-3.5">Tiket & Judul</th>
                                    <th className="px-5 py-3.5">Unit / Pemohon</th>
                                    <th className="px-5 py-3.5">Teknisi</th>
                                    <th className="px-5 py-3.5">Status</th>
                                    <th className="px-5 py-3.5">Tanggal Pengerjaan</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {details.maintenances.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-5 py-8 text-center text-slate-400 font-semibold">
                                            Tidak ada riwayat pemeliharaan pada periode ini.
                                        </td>
                                    </tr>
                                ) : (
                                    details.maintenances.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="px-5 py-3.5">
                                                <div className="font-bold text-slate-800">{item.title}</div>
                                                <div className="text-[10px] text-amber-600 font-mono font-semibold">{item.code}</div>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="font-semibold text-slate-700">{item.unit?.name || '-'}</div>
                                                <div className="text-[11px] text-slate-400">{item.user?.name || '-'}</div>
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-600 font-medium">
                                                {item.technician || '-'}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded-full text-[10px] font-black uppercase",
                                                    item.status === 'COMPLETED' ? "bg-emerald-50 text-emerald-700" :
                                                    item.status === 'IN_PROGRESS' ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"
                                                )}>
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-500">
                                                {new Date(item.createdAt).toLocaleDateString('id-ID')}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* TAB CONTENT: AUDIT */}
                {activeTab === 'audit' && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider">
                                <tr>
                                    <th className="px-5 py-3.5">Aset</th>
                                    <th className="px-5 py-3.5">Sesi Audit</th>
                                    <th className="px-5 py-3.5">Status Temuan</th>
                                    <th className="px-5 py-3.5">Kondisi</th>
                                    <th className="px-5 py-3.5">Auditor</th>
                                    <th className="px-5 py-3.5">Tanggal Verifikasi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {details.auditItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-5 py-8 text-center text-slate-400 font-semibold">
                                            Tidak ada catatan audit fisik aset pada periode ini.
                                        </td>
                                    </tr>
                                ) : (
                                    details.auditItems.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="px-5 py-3.5">
                                                <div className="font-bold text-slate-800">{item.asset?.name}</div>
                                                <div className="text-[10px] text-emerald-600 font-mono font-semibold">{item.asset?.code}</div>
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-600 font-medium">
                                                {item.session?.title || '-'}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded-full text-[10px] font-black uppercase",
                                                    item.status === 'FOUND' ? "bg-emerald-50 text-emerald-700" :
                                                    item.status === 'MISSING' ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"
                                                )}>
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 font-semibold text-slate-700">
                                                {item.foundCondition || '-'}
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-600">
                                                {item.auditor?.name || '-'}
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-500">
                                                {item.verifiedAt ? new Date(item.verifiedAt).toLocaleDateString('id-ID') : '-'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* TAB CONTENT: LOANS */}
                {activeTab === 'loans' && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider">
                                <tr>
                                    <th className="px-5 py-3.5">Aset</th>
                                    <th className="px-5 py-3.5">Peminjam</th>
                                    <th className="px-5 py-3.5">Unit Tujuan</th>
                                    <th className="px-5 py-3.5">Tgl Pinjam</th>
                                    <th className="px-5 py-3.5">Est. Kembali</th>
                                    <th className="px-5 py-3.5">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {details.loans.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-5 py-8 text-center text-slate-400 font-semibold">
                                            Tidak ada peminjaman aset pada periode ini.
                                        </td>
                                    </tr>
                                ) : (
                                    details.loans.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="px-5 py-3.5">
                                                <div className="font-bold text-slate-800">{item.asset?.name}</div>
                                                <div className="text-[10px] text-violet-600 font-mono font-semibold">{item.asset?.code}</div>
                                            </td>
                                            <td className="px-5 py-3.5 font-semibold text-slate-700">
                                                {item.borrower?.name || '-'}
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-600">
                                                {item.targetUnit?.name || '-'}
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-500">
                                                {item.borrowDate ? new Date(item.borrowDate).toLocaleDateString('id-ID') : '-'}
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-500">
                                                {item.expectedReturnDate ? new Date(item.expectedReturnDate).toLocaleDateString('id-ID') : '-'}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded-full text-[10px] font-black uppercase",
                                                    item.status === 'BORROWED' ? "bg-amber-50 text-amber-700" :
                                                    item.status === 'RETURNED' ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                                                )}>
                                                    {item.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* TAB CONTENT: DISPOSALS */}
                {activeTab === 'disposals' && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider">
                                <tr>
                                    <th className="px-5 py-3.5">Aset</th>
                                    <th className="px-5 py-3.5">Alasan</th>
                                    <th className="px-5 py-3.5">Metode</th>
                                    <th className="px-5 py-3.5">Pengusul</th>
                                    <th className="px-5 py-3.5">Status</th>
                                    <th className="px-5 py-3.5">Tgl Pengajuan</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {details.disposals.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-5 py-8 text-center text-slate-400 font-semibold">
                                            Tidak ada usulan penghapusan aset pada periode ini.
                                        </td>
                                    </tr>
                                ) : (
                                    details.disposals.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="px-5 py-3.5">
                                                <div className="font-bold text-slate-800">{item.asset?.name}</div>
                                                <div className="text-[10px] text-rose-600 font-mono font-semibold">{item.asset?.code}</div>
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-700 font-medium">
                                                {item.reason || '-'}
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-600">
                                                {item.method || '-'}
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-600">
                                                {item.proposedBy?.name || '-'}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded-full text-[10px] font-black uppercase",
                                                    item.status === 'APPROVED' ? "bg-emerald-50 text-emerald-700" :
                                                    item.status === 'REJECTED' ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"
                                                )}>
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-500">
                                                {new Date(item.createdAt).toLocaleDateString('id-ID')}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* 4. OFFICIAL PRINTABLE REPORT CONTAINER (ZERO PRICE - FOKUS KUANTITAS & STATISTIK) */}
            <div 
                id="printable-weekly-report"
                className={cn(
                    "bg-white rounded-3xl border border-slate-200 shadow-sm p-8 md:p-12 space-y-8 max-w-4xl mx-auto text-slate-800",
                    "print:border-none print:shadow-none print:p-0 print:!block print:max-w-none print:w-full print:m-0",
                    showPrintPreview ? "block" : "hidden print:!block"
                )}
            >
                {/* KOP SURAT RESMI */}
                <div className="text-center border-b-2 border-slate-800 pb-4 space-y-1">
                    <h2 className="text-2xl font-black tracking-wider text-slate-900 uppercase">BIDANG SARANA</h2>
                    <h3 className="text-xs font-black text-indigo-900 uppercase tracking-widest">YAYASAN DAR EL-IMAN</h3>
                    <p className="text-[11px] text-slate-600">Jl. Gunuang Juaro, Surau Gadang, Kec. Nanggalo, Kota Padang, Sumatera Barat</p>
                </div>

                {/* JUDUL LAPORAN */}
                <div className="text-center space-y-1">
                    <h4 className="text-sm font-black uppercase tracking-wider underline">
                        {preset === 'today' ? 'LAPORAN OPERASIONAL & PERGERAKAN ASET HARIAN (HARI INI)' :
                         preset === 'yesterday' ? 'LAPORAN OPERASIONAL & PERGERAKAN ASET HARIAN (KEMARIN)' :
                         preset === 'this_week' ? 'LAPORAN OPERASIONAL & PERGERAKAN ASET MINGGUAN (MINGGU INI)' :
                         preset === 'last_week' ? 'LAPORAN OPERASIONAL & PERGERAKAN ASET MINGGUAN (MINGGU LALU)' :
                         preset === 'this_month' ? 'LAPORAN OPERASIONAL & PERGERAKAN ASET BULANAN (BULAN INI)' :
                         preset === 'last_month' ? 'LAPORAN OPERASIONAL & PERGERAKAN ASET BULANAN (BULAN LALU)' :
                         'LAPORAN OPERASIONAL & PERGERAKAN ASET BERKALA'}
                    </h4>
                    <p className="text-xs font-bold text-slate-600">
                        Periode: {data?.period?.formattedPeriod || `${startDate} s/d ${endDate}`}
                    </p>
                    <p className="text-[11px] font-medium text-slate-500">
                        Lingkup Satuan Kerja: {data?.unit || 'Seluruh Unit / Satker'}
                    </p>
                </div>

                {/* RINGKASAN EKSEKUTIF AI PADA CETAK RESMI */}
                {aiSummary?.narrativeSummary && (
                    <div className="bg-slate-50 border border-slate-300 rounded-lg p-3 text-xs space-y-1">
                        <div className="flex items-center justify-between font-bold text-indigo-900 border-b border-slate-200 pb-1">
                            <span className="flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
                                <Sparkles size={12} className="text-amber-500" />
                                Ringkasan Eksekutif Operasional Aset (Analisis Cerdas AI)
                            </span>
                            <span className="text-[10px] text-slate-600 font-semibold">
                                Status: {aiSummary.operationalStatusLabel || 'Operasional Terpantau'}
                            </span>
                        </div>
                        <p className="text-slate-800 leading-relaxed text-[11px] pt-0.5">
                            {aiSummary.narrativeSummary}
                        </p>
                    </div>
                )}

                {/* I. REKAPITULASI METRIK */}
                <div className="space-y-2">
                    <h5 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
                        I. Ringkasan Rekapitulasi Kuantitas & Mutasi Aset
                    </h5>
                    <table className="w-full text-xs border border-slate-300 mt-2">
                        <thead className="bg-slate-100 font-bold text-slate-700">
                            <tr>
                                <th className="border border-slate-300 px-3 py-2 text-center w-12">No</th>
                                <th className="border border-slate-300 px-3 py-2 text-left">Indikator Aktivitas Aset</th>
                                <th className="border border-slate-300 px-3 py-2 text-center w-28">Jumlah Fisik</th>
                                <th className="border border-slate-300 px-3 py-2 text-left">Keterangan Operasional</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="border border-slate-300 px-3 py-1.5 text-center">1</td>
                                <td className="border border-slate-300 px-3 py-1.5 font-medium">Aset Baru Masuk (Pengadaan / Registrasi)</td>
                                <td className="border border-slate-300 px-3 py-1.5 text-center font-bold">{summary.newAssetsCount} unit</td>
                                <td className="border border-slate-300 px-3 py-1.5 text-slate-600">{groupedNewAssets.length} macam jenis barang inventaris baru</td>
                            </tr>
                            <tr>
                                <td className="border border-slate-300 px-3 py-1.5 text-center">2</td>
                                <td className="border border-slate-300 px-3 py-1.5 font-medium">Mutasi & Perpindahan Ruangan/Unit</td>
                                <td className="border border-slate-300 px-3 py-1.5 text-center font-bold">{summary.movementsCount} transaksi</td>
                                <td className="border border-slate-300 px-3 py-1.5 text-slate-600">Relokasi / mutasi sarana antar unit dan ruangan</td>
                            </tr>
                            <tr>
                                <td className="border border-slate-300 px-3 py-1.5 text-center">3</td>
                                <td className="border border-slate-300 px-3 py-1.5 font-medium">Pemeliharaan & Perbaikan Sarana</td>
                                <td className="border border-slate-300 px-3 py-1.5 text-center font-bold">{summary.maintenanceCount} tiket</td>
                                <td className="border border-slate-300 px-3 py-1.5 text-slate-600">{statistics.maintenance.completed} selesai ({statistics.maintenance.completionRate}%), {statistics.maintenance.inProgress} pengerjaan, {statistics.maintenance.pending} antri</td>
                            </tr>
                            <tr>
                                <td className="border border-slate-300 px-3 py-1.5 text-center">4</td>
                                <td className="border border-slate-300 px-3 py-1.5 font-medium">Audit & Verifikasi Fisik Aset Lapangan</td>
                                <td className="border border-slate-300 px-3 py-1.5 text-center font-bold">{summary.auditCount} item</td>
                                <td className="border border-slate-300 px-3 py-1.5 text-slate-600">{statistics.audit.found} terdata ada ({statistics.audit.accuracyRate}%), {statistics.audit.missing} belum terverifikasi</td>
                            </tr>
                            <tr>
                                <td className="border border-slate-300 px-3 py-1.5 text-center">5</td>
                                <td className="border border-slate-300 px-3 py-1.5 font-medium">Peminjaman Aset Antar Unit / Luar</td>
                                <td className="border border-slate-300 px-3 py-1.5 text-center font-bold">{summary.loansCount} transaksi</td>
                                <td className="border border-slate-300 px-3 py-1.5 text-slate-600">{statistics.loans.borrowed} aktif dipinjam, {statistics.loans.returned} sudah dikembalikan</td>
                            </tr>
                            <tr>
                                <td className="border border-slate-300 px-3 py-1.5 text-center">6</td>
                                <td className="border border-slate-300 px-3 py-1.5 font-medium">Usulan Penghapusan (Disposal / Rusak Berat)</td>
                                <td className="border border-slate-300 px-3 py-1.5 text-center font-bold">{summary.disposalsCount} item</td>
                                <td className="border border-slate-300 px-3 py-1.5 text-slate-600">Usulan pemusnahan / lelang aset kondisi rusak berat</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* II. ANALISIS STATISTIK OPERASIONAL */}
                <div className="space-y-2">
                    <h5 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
                        II. Analisis Statistik Kinerja Operasional & Distribusi Kategori
                    </h5>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                        <table className="w-full border border-slate-300">
                            <thead className="bg-slate-100 font-bold text-slate-700">
                                <tr>
                                    <th colSpan={2} className="border border-slate-300 px-3 py-1.5 text-left uppercase text-[10px]">Indikator Efektivitas Sarpras</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="border border-slate-300 px-3 py-1.5 font-medium">Tingkat Penyelesaian Servis</td>
                                    <td className="border border-slate-300 px-3 py-1.5 font-bold text-right">{statistics.maintenance.completionRate}% ({statistics.maintenance.completed}/{statistics.maintenance.total} tiket)</td>
                                </tr>
                                <tr>
                                    <td className="border border-slate-300 px-3 py-1.5 font-medium">Akurasi Verifikasi Cek Fisik</td>
                                    <td className="border border-slate-300 px-3 py-1.5 font-bold text-right">{statistics.audit.accuracyRate}% ({statistics.audit.found}/{statistics.audit.total} item)</td>
                                </tr>
                                <tr>
                                    <td className="border border-slate-300 px-3 py-1.5 font-medium">Rata-rata Transaksi Harian</td>
                                    <td className="border border-slate-300 px-3 py-1.5 font-bold text-right">{statistics.operational.avgDailyEvents} transaksi / hari</td>
                                </tr>
                                <tr>
                                    <td className="border border-slate-300 px-3 py-1.5 font-medium">Satuan Kerja Teraktif</td>
                                    <td className="border border-slate-300 px-3 py-1.5 font-bold text-right">{statistics.operational.mostActiveUnit}</td>
                                </tr>
                            </tbody>
                        </table>

                        <table className="w-full border border-slate-300">
                            <thead className="bg-slate-100 font-bold text-slate-700">
                                <tr>
                                    <th className="border border-slate-300 px-3 py-1.5 text-left">Kategori Aset Baru</th>
                                    <th className="border border-slate-300 px-3 py-1.5 text-center w-16">Jumlah</th>
                                    <th className="border border-slate-300 px-3 py-1.5 text-right w-16">Porsi %</th>
                                </tr>
                            </thead>
                            <tbody>
                                {statistics.categoryDistribution.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="border border-slate-300 px-3 py-3 text-center text-slate-400">
                                            Tidak ada penambahan kategori pada periode ini
                                        </td>
                                    </tr>
                                ) : (
                                    statistics.categoryDistribution.slice(0, 4).map((cat, idx) => (
                                        <tr key={idx}>
                                            <td className="border border-slate-300 px-3 py-1.5 font-medium">{cat.name}</td>
                                            <td className="border border-slate-300 px-3 py-1.5 text-center font-bold">{cat.count}</td>
                                            <td className="border border-slate-300 px-3 py-1.5 text-right font-bold">{cat.percentage}%</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* III. RINGKASAN SEBARAN PER UNIT */}
                {unitSummary.length > 0 && (
                    <div className="space-y-2">
                        <h5 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
                            III. Ringkasan Sebaran Aktivitas per Satuan Kerja / Unit
                        </h5>
                        <table className="w-full text-[10px] border border-slate-300 mt-2">
                            <thead className="bg-slate-100 font-bold text-slate-700">
                                <tr>
                                    <th className="border border-slate-300 px-2 py-1.5 text-center w-8">No</th>
                                    <th className="border border-slate-300 px-2 py-1.5 text-left">Nama Satker / Unit</th>
                                    <th className="border border-slate-300 px-2 py-1.5 text-center w-14">Aset Baru</th>
                                    <th className="border border-slate-300 px-2 py-1.5 text-center w-14">Mutasi</th>
                                    <th className="border border-slate-300 px-2 py-1.5 text-center w-14">Servis</th>
                                    <th className="border border-slate-300 px-2 py-1.5 text-center w-14">Cek Fisik</th>
                                    <th className="border border-slate-300 px-2 py-1.5 text-center w-14">Pinjam</th>
                                    <th className="border border-slate-300 px-2 py-1.5 text-center w-14">Hapus</th>
                                    <th className="border border-slate-300 px-2 py-1.5 text-center w-20">Total Aset</th>
                                </tr>
                            </thead>
                            <tbody>
                                {unitSummary.map((u, idx) => (
                                    <tr key={u.id}>
                                        <td className="border border-slate-300 px-2 py-1 text-center">{idx + 1}</td>
                                        <td className="border border-slate-300 px-2 py-1 font-bold text-slate-900">{u.name}</td>
                                        <td className="border border-slate-300 px-2 py-1 text-center">{u.newAssets ? u.newAssets : '-'}</td>
                                        <td className="border border-slate-300 px-2 py-1 text-center">{u.movements ? u.movements : '-'}</td>
                                        <td className="border border-slate-300 px-2 py-1 text-center">{u.maintenance ? u.maintenance : '-'}</td>
                                        <td className="border border-slate-300 px-2 py-1 text-center">{u.audit ? u.audit : '-'}</td>
                                        <td className="border border-slate-300 px-2 py-1 text-center">{u.loans ? u.loans : '-'}</td>
                                        <td className="border border-slate-300 px-2 py-1 text-center">{u.disposals ? u.disposals : '-'}</td>
                                        <td className="border border-slate-300 px-2 py-1 text-center font-black text-slate-900">{(u.activeAssetsCount || 0).toLocaleString('id-ID')} unit</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-100 font-bold text-slate-900">
                                <tr>
                                    <td colSpan={2} className="border border-slate-300 px-2 py-1 text-right uppercase">Total</td>
                                    <td className="border border-slate-300 px-2 py-1 text-center">{summary.newAssetsCount}</td>
                                    <td className="border border-slate-300 px-2 py-1 text-center">{summary.movementsCount}</td>
                                    <td className="border border-slate-300 px-2 py-1 text-center">{summary.maintenanceCount}</td>
                                    <td className="border border-slate-300 px-2 py-1 text-center">{summary.auditCount}</td>
                                    <td className="border border-slate-300 px-2 py-1 text-center">{summary.loansCount}</td>
                                    <td className="border border-slate-300 px-2 py-1 text-center">{summary.disposalsCount}</td>
                                    <td className="border border-slate-300 px-2 py-1 text-center font-black">{unitSummary.reduce((acc, u) => acc + (u.activeAssetsCount || 0), 0).toLocaleString('id-ID')} unit</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}

                {/* IV. REKAPITULASI KUANTITAS ASET BARU */}
                {groupedNewAssets.length > 0 && (
                    <div className="space-y-2">
                        <h5 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
                            IV. Rekapitulasi Kuantitas Aset Baru Masuk (Pengadaan)
                        </h5>
                        <table className="w-full text-[11px] border border-slate-300 mt-2">
                            <thead className="bg-slate-100 font-bold text-slate-700">
                                <tr>
                                    <th className="border border-slate-300 px-2 py-1.5 text-center w-8">No</th>
                                    <th className="border border-slate-300 px-3 py-1.5 text-left">Nama Barang / Aset</th>
                                    <th className="border border-slate-300 px-3 py-1.5 text-left w-36">Kategori</th>
                                    <th className="border border-slate-300 px-3 py-1.5 text-left w-40">Unit Penerima</th>
                                    <th className="border border-slate-300 px-2 py-1.5 text-center w-24">Jumlah Fisik</th>
                                    <th className="border border-slate-300 px-3 py-1.5 text-center w-28">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {groupedNewAssets.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="border border-slate-300 px-2 py-1.5 text-center">{idx + 1}</td>
                                        <td className="border border-slate-300 px-3 py-1.5 font-bold text-slate-900">
                                            {item.name}
                                        </td>
                                        <td className="border border-slate-300 px-3 py-1.5 text-slate-600">{item.category}</td>
                                        <td className="border border-slate-300 px-3 py-1.5 text-slate-600">{item.unit}</td>
                                        <td className="border border-slate-300 px-2 py-1.5 text-center font-black text-slate-900">
                                            {item.qty} unit
                                        </td>
                                        <td className="border border-slate-300 px-3 py-1.5 text-center text-emerald-800 font-semibold">
                                            Terdaftar
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-50 font-bold text-slate-800">
                                <tr>
                                    <td colSpan={4} className="border border-slate-300 px-3 py-1.5 text-right uppercase text-[10px]">
                                        Total Pengadaan ({groupedNewAssets.length} Jenis Barang)
                                    </td>
                                    <td className="border border-slate-300 px-2 py-1.5 text-center font-black text-indigo-900">
                                        {summary.newAssetsCount} unit
                                    </td>
                                    <td className="border border-slate-300 px-3 py-1.5 text-center text-slate-500">
                                        Lengkap
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}

                {/* V. DETAIL MUTASI */}
                {details.movements.length > 0 && (
                    <div className="space-y-2">
                        <h5 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
                            V. Rekapitulasi Mutasi & Perpindahan Aset
                        </h5>
                        <table className="w-full text-[11px] border border-slate-300 mt-2">
                            <thead className="bg-slate-100 font-bold text-slate-700">
                                <tr>
                                    <th className="border border-slate-300 px-2 py-1 text-center w-8">No</th>
                                    <th className="border border-slate-300 px-2 py-1 text-left">Nama Aset</th>
                                    <th className="border border-slate-300 px-2 py-1 text-left">Dari Lokasi</th>
                                    <th className="border border-slate-300 px-2 py-1 text-left">Menuju Lokasi</th>
                                    <th className="border border-slate-300 px-2 py-1 text-center w-20">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {details.movements.map((item, idx) => (
                                    <tr key={item.id}>
                                        <td className="border border-slate-300 px-2 py-1 text-center">{idx + 1}</td>
                                        <td className="border border-slate-300 px-2 py-1 font-bold">{item.asset?.name || '-'}</td>
                                        <td className="border border-slate-300 px-2 py-1">{item.fromLocation || '-'}</td>
                                        <td className="border border-slate-300 px-2 py-1 font-semibold">{item.toLocation || '-'}</td>
                                        <td className="border border-slate-300 px-2 py-1 text-center font-bold">{item.status}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* VI. DETAIL PEMELIHARAAN (ZERO PRICE) */}
                {details.maintenances.length > 0 && (
                    <div className="space-y-2">
                        <h5 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
                            VI. Rekapitulasi Pemeliharaan & Perbaikan Sarana
                        </h5>
                        <table className="w-full text-[11px] border border-slate-300 mt-2">
                            <thead className="bg-slate-100 font-bold text-slate-700">
                                <tr>
                                    <th className="border border-slate-300 px-2 py-1 text-center w-8">No</th>
                                    <th className="border border-slate-300 px-2 py-1 text-left">Tiket / Judul Pemeliharaan</th>
                                    <th className="border border-slate-300 px-2 py-1 text-left">Unit</th>
                                    <th className="border border-slate-300 px-2 py-1 text-left">Teknisi</th>
                                    <th className="border border-slate-300 px-2 py-1 text-center w-28">Status Pengerjaan</th>
                                </tr>
                            </thead>
                            <tbody>
                                {details.maintenances.map((item, idx) => (
                                    <tr key={item.id}>
                                        <td className="border border-slate-300 px-2 py-1 text-center">{idx + 1}</td>
                                        <td className="border border-slate-300 px-2 py-1">
                                            <div className="font-bold">{item.title}</div>
                                            <div className="text-[10px] text-slate-400">{item.code}</div>
                                        </td>
                                        <td className="border border-slate-300 px-2 py-1">{item.unit?.name || '-'}</td>
                                        <td className="border border-slate-300 px-2 py-1 text-slate-600">{item.technician || '-'}</td>
                                        <td className="border border-slate-300 px-2 py-1 text-center font-bold">{item.status}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* BLOK TANDA TANGAN RESMI (KEPALA BIDANG SARANA) */}
                <div className="pt-8 flex justify-end text-center text-xs">
                    <div className="w-64">
                        <p className="font-semibold text-slate-600">Mengetahui,</p>
                        <p className="text-[11px] text-slate-800 font-bold mb-20 mt-0.5">Kepala Bidang Sarana</p>
                        <p className="font-black text-slate-900 underline uppercase text-sm">{data?.signers?.kabid?.name || 'Ravi Kurnia'}</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">NIY: {data?.signers?.kabid?.niy || '-'}</p>
                    </div>
                </div>

                <div className="text-[10px] text-center text-slate-400 border-t border-slate-200 pt-3">
                    Dokumen dicetak otomatis melalui Sistem Informasi Manajemen Aset & Sarpras Yayasan Dar El-Iman Padang
                </div>
            </div>

            {/* ISOLATED PRINT STYLES FOR SAFE BROWSER PRINTING */}
            <style>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    #printable-weekly-report, #printable-weekly-report * {
                        visibility: visible !important;
                    }
                    #printable-weekly-report {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        display: block !important;
                        padding: 10mm 12mm !important;
                        margin: 0 !important;
                        border: none !important;
                        box-shadow: none !important;
                    }
                    html, body, #root, .flex-1, main {
                        height: auto !important;
                        overflow: visible !important;
                        background: white !important;
                    }
                }
            `}</style>
        </div>
    );
}
