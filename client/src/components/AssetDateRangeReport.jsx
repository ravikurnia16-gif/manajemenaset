import React, { useState, useEffect, useMemo } from 'react';
import {
    CalendarRange, Calendar, Box, ShoppingCart, Wrench, Download,
    RefreshCw, Filter, CheckCircle2, AlertTriangle, AlertCircle,
    TrendingUp, FileText, Check, DollarSign, Layers, ChevronRight,
    ArrowUpRight, Loader2, Sparkles, Building2, Package, Search,
    SlidersHorizontal, Eye, ExternalLink, X, ShieldAlert
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend, Cell, PieChart, Pie
} from 'recharts';
import api from '../lib/axios';
import { cn } from '../lib/utils';

// Helper load jsPDF & autoTable dynamically
async function getJsPDF() {
    try {
        const { default: jsPDF } = await import('jspdf');
        const autoTableModule = await import('jspdf-autotable');
        const autoTable = autoTableModule.default || autoTableModule;
        return { jsPDF, autoTable };
    } catch {
        return new Promise((resolve, reject) => {
            if (window.jspdf) {
                resolve({
                    jsPDF: window.jspdf.jsPDF,
                    autoTable: (doc, opts) => doc.autoTable ? doc.autoTable(opts) : window.jspdf.autoTable(doc, opts)
                });
                return;
            }
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            s.onload = () => {
                const s2 = document.createElement('script');
                s2.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
                s2.onload = () => resolve({
                    jsPDF: window.jspdf.jsPDF,
                    autoTable: (doc, opts) => doc.autoTable(opts)
                });
                s2.onerror = reject;
                document.head.appendChild(s2);
            };
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }
}

const COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#3b82f6'];

export default function AssetDateRangeReport({ currentUser }) {
    // Preset state: 'this_month' | 'last_30_days' | 'last_7_days' | 'today' | 'last_month' | 'custom'
    const [preset, setPreset] = useState('this_month');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedUnit, setSelectedUnit] = useState('all');
    const [activeSection, setActiveSection] = useState('all'); // 'all' | 'assets' | 'procurement' | 'maintenance' | 'items'

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [itemSearch, setItemSearch] = useState('');
    const [maintSearch, setMaintSearch] = useState('');

    // Hitung tanggal awal & akhir sesuai preset
    const calculateDatesForPreset = (p) => {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

        if (p === 'today') {
            const todayStr = toYMD(now);
            return { start: todayStr, end: todayStr };
        } else if (p === 'last_7_days') {
            const past7 = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
            return { start: toYMD(past7), end: toYMD(now) };
        } else if (p === 'last_30_days') {
            const past30 = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
            return { start: toYMD(past30), end: toYMD(now) };
        } else if (p === 'this_month') {
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            return { start: toYMD(firstDay), end: toYMD(now) };
        } else if (p === 'last_month') {
            const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
            return { start: toYMD(firstDay), end: toYMD(lastDay) };
        }
        return { start: startDate, end: endDate };
    };

    // Inisialisasi awal
    useEffect(() => {
        const { start, end } = calculateDatesForPreset('this_month');
        setStartDate(start);
        setEndDate(end);
    }, []);

    // Fetch data setiap perubahan tanggal / unit
    const fetchReport = async (overrideStart, overrideEnd, overrideUnit) => {
        const s = overrideStart || startDate;
        const e = overrideEnd || endDate;
        const u = overrideUnit !== undefined ? overrideUnit : selectedUnit;

        if (!s || !e) return;

        try {
            setLoading(true);
            const params = {
                startDate: s,
                endDate: e
            };
            if (u && u !== 'all') {
                params.unitId = u;
            }

            const res = await api.get('/dashboard/date-range-report', { params });
            if (res.data?.success) {
                setData(res.data);
            }
        } catch (err) {
            console.error('Failed to load date range report:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (startDate && endDate) {
            fetchReport(startDate, endDate, selectedUnit);
        }
    }, [startDate, endDate, selectedUnit]);

    const handlePresetChange = (newPreset) => {
        setPreset(newPreset);
        if (newPreset !== 'custom') {
            const { start, end } = calculateDatesForPreset(newPreset);
            setStartDate(start);
            setEndDate(end);
        }
    };

    // Ekstraksi data
    const assetSummary = data?.assetSummary || {
        totalAssets: 0,
        totalValue: 0,
        goodCount: 0,
        lightDamagedCount: 0,
        heavyDamagedCount: 0,
        assetsPerUnit: []
    };

    const procurementSummary = data?.procurementSummary || {
        totalSubmitted: 0,
        submittedByUnit: [],
        totalFinalized: 0,
        finalizedByUnit: [],
        finalizedList: [],
        purchasedItems: []
    };

    const maintenanceSummary = data?.maintenanceSarprasSummary || {
        totalSubmitted: 0,
        submittedByUnit: [],
        totalCompleted: 0,
        completedByUnit: [],
        completedList: []
    };

    // Filter daftar barang yang dibeli berdasarkan pencarian
    const filteredPurchasedItems = useMemo(() => {
        if (!itemSearch.trim()) return procurementSummary.purchasedItems || [];
        const q = itemSearch.toLowerCase();
        return (procurementSummary.purchasedItems || []).filter(item =>
            (item.name || '').toLowerCase().includes(q) ||
            (item.spec || '').toLowerCase().includes(q) ||
            (item.unitName || '').toLowerCase().includes(q) ||
            (item.vendor || '').toLowerCase().includes(q) ||
            (item.procurementCode || '').toLowerCase().includes(q)
        );
    }, [procurementSummary.purchasedItems, itemSearch]);

    // Filter pemeliharaan selesai berdasarkan pencarian
    const filteredCompletedMaint = useMemo(() => {
        if (!maintSearch.trim()) return maintenanceSummary.completedList || [];
        const q = maintSearch.toLowerCase();
        return (maintenanceSummary.completedList || []).filter(m =>
            (m.title || '').toLowerCase().includes(q) ||
            (m.code || '').toLowerCase().includes(q) ||
            (m.unitName || '').toLowerCase().includes(q) ||
            (m.technician || '').toLowerCase().includes(q) ||
            (m.actionTaken || '').toLowerCase().includes(q)
        );
    }, [maintenanceSummary.completedList, maintSearch]);

    // Format tanggal Indonesia
    const formatDateIndo = (dStr) => {
        if (!dStr) return '-';
        try {
            return new Date(dStr).toLocaleDateString('id-ID', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
        } catch {
            return dStr;
        }
    };

    // Label rentang periode
    const periodLabel = useMemo(() => {
        if (!startDate || !endDate) return '-';
        return `${formatDateIndo(startDate)} s/d ${formatDateIndo(endDate)}`;
    }, [startDate, endDate]);

    // Total anggaran pengadaan diajukan
    const totalProcurementBudget = useMemo(() => {
        return (procurementSummary.submittedByUnit || []).reduce((sum, u) => sum + (u.totalEstBudget || 0), 0);
    }, [procurementSummary.submittedByUnit]);

    // Total pengeluaran pemeliharaan sarpras selesai
    const totalMaintenanceCompletedCost = useMemo(() => {
        return (maintenanceSummary.completedList || []).reduce((sum, m) => sum + (m.cost || 0), 0);
    }, [maintenanceSummary.completedList]);

    // =========================================================================
    // EXPORT PDF LAPORAN EKSEKUTIF (LANDSCAPE A4, RAPI, BERSIH, MUDAH DIBACA)
    // =========================================================================
    const handleExportPDF = async () => {
        if (!data) return;
        setExporting(true);
        try {
            const { jsPDF, autoTable } = await getJsPDF();
            const doc = new jsPDF('landscape', 'mm', 'a4');
            const pageW = doc.internal.pageSize.getWidth();
            const pageH = doc.internal.pageSize.getHeight();
            const now = new Date();

            const applyHeader = (titleText) => {
                // Kop Surat
                doc.setFontSize(14);
                doc.setFont(undefined, 'bold');
                doc.setTextColor(30, 41, 59);
                doc.text('YAYASAN DAR EL IMAN', pageW / 2, 13, { align: 'center' });

                doc.setFontSize(10);
                doc.setFont(undefined, 'bold');
                doc.setTextColor(79, 70, 229); // Indigo
                doc.text('BIDANG SARANA', pageW / 2, 18, { align: 'center' });

                doc.setFontSize(11);
                doc.setFont(undefined, 'bold');
                doc.setTextColor(15, 23, 42);
                doc.text(titleText, pageW / 2, 24, { align: 'center' });

                doc.setFontSize(8);
                doc.setFont(undefined, 'normal');
                doc.setTextColor(100, 116, 139);
                doc.text(
                    `Rentang Periode: ${periodLabel}   |   Tanggal Cetak: ${now.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}   |   Pencetak: ${currentUser?.name || 'Administrator'}`,
                    pageW / 2,
                    29,
                    { align: 'center' }
                );

                doc.setDrawColor(203, 213, 225);
                doc.setLineWidth(0.5);
                doc.line(14, 32, pageW - 14, 32);
            };

            const callAutoTable = (options) => {
                if (typeof autoTable === 'function') {
                    autoTable(doc, options);
                } else if (doc.autoTable) {
                    doc.autoTable(options);
                }
            };

            // -------------------------------------------------------------
            // HALAMAN 1: BAGIAN 1 - JUMLAH ASET SAAT INI (MENYELURUH & PER UNIT)
            // -------------------------------------------------------------
            applyHeader('LAPORAN EKSEKUTIF I: JUMLAH ASET SAAT INI (STATUS FISIK & DISTRIBUSI UNIT)');

            // Tabel 1A: Ringkasan Menyeluruh
            doc.setFontSize(9.5);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text('1. Total Aset Menyeluruh (Fisik Aktif & Kondisi Terkini)', 14, 38);

            callAutoTable({
                startY: 41,
                head: [['Total Fisik Aset Aktif', 'Kondisi BAIK', 'Kondisi RUSAK RINGAN', 'Kondisi RUSAK BERAT', 'Estimasi Total Nilai Aset']],
                body: [[
                    `${(assetSummary.totalAssets || 0).toLocaleString('id-ID')} Unit`,
                    `${(assetSummary.goodCount || 0).toLocaleString('id-ID')} Unit (${assetSummary.totalAssets > 0 ? Math.round((assetSummary.goodCount / assetSummary.totalAssets) * 100) : 0}%)`,
                    `${(assetSummary.lightDamagedCount || 0).toLocaleString('id-ID')} Unit (${assetSummary.totalAssets > 0 ? Math.round((assetSummary.lightDamagedCount / assetSummary.totalAssets) * 100) : 0}%)`,
                    `${(assetSummary.heavyDamagedCount || 0).toLocaleString('id-ID')} Unit (${assetSummary.totalAssets > 0 ? Math.round((assetSummary.heavyDamagedCount / assetSummary.totalAssets) * 100) : 0}%)`,
                    `Rp ${(assetSummary.totalValue || 0).toLocaleString('id-ID')}`
                ]],
                theme: 'grid',
                headStyles: { fillColor: [49, 46, 129], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 8.5 },
                bodyStyles: { fontSize: 8.5, halign: 'center', fontStyle: 'bold', textColor: [30, 41, 59] },
                styles: { cellPadding: 3 }
            });

            const afterTable1A = doc.lastAutoTable ? doc.lastAutoTable.finalY : 58;

            // Tabel 1B: Total Aset per Unit
            doc.setFontSize(9.5);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text('2. Total Aset per Satuan Kerja / Unit', 14, afterTable1A + 8);

            const unitRows = (assetSummary.assetsPerUnit || []).map((u, i) => [
                i + 1,
                u.unitCode || '-',
                u.unitName,
                `${(u.totalAssets || 0).toLocaleString('id-ID')} Unit`,
                `${(u.goodCount || 0).toLocaleString('id-ID')}`,
                `${(u.lightDamagedCount || 0).toLocaleString('id-ID')}`,
                `${(u.heavyDamagedCount || 0).toLocaleString('id-ID')}`,
                `Rp ${(u.totalValue || 0).toLocaleString('id-ID')}`
            ]);

            callAutoTable({
                startY: afterTable1A + 11,
                head: [['No', 'Kode', 'Nama Satuan Kerja / Unit', 'Total Aset', 'Baik', 'R. Ringan', 'R. Berat', 'Total Nilai']],
                body: unitRows.length > 0 ? unitRows : [['-', '-', 'Tidak ada data aset terdaftar', '0', '0', '0', '0', 'Rp 0']],
                theme: 'striped',
                headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
                bodyStyles: { fontSize: 7.5, cellPadding: 2.5 },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 10 },
                    1: { halign: 'center', cellWidth: 20 },
                    2: { halign: 'left', cellWidth: 75 },
                    3: { halign: 'center', cellWidth: 30, fontStyle: 'bold' },
                    4: { halign: 'center', cellWidth: 22 },
                    5: { halign: 'center', cellWidth: 24 },
                    6: { halign: 'center', cellWidth: 24 },
                    7: { halign: 'right', cellWidth: 64, fontStyle: 'bold' }
                }
            });

            // -------------------------------------------------------------
            // HALAMAN 2: BAGIAN 2 - PENGADAAN (MASUK PER UNIT, FINALISASI & BARANG)
            // -------------------------------------------------------------
            doc.addPage();
            applyHeader('LAPORAN EKSEKUTIF II: PENGADAAN (PENGAJUAN MASUK, FINALISASI & JENIS BARANG DIBELI)');

            doc.setFontSize(9.5);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text('1. Pengajuan Pengadaan Masuk per Unit (Hanya Unit yang Mengajukan / Pengajuan > 0)', 14, 38);

            const procSubmittedRows = (procurementSummary.submittedByUnit || []).map((u, i) => [
                i + 1,
                u.unitName,
                `${u.totalSubmissions} Pengajuan`,
                `${u.pendingCount || 0}`,
                `${u.processCount || 0}`,
                `${u.completedCount || 0}`,
                `${u.rejectedCount || 0}`,
                `Rp ${(u.totalEstBudget || 0).toLocaleString('id-ID')}`
            ]);

            callAutoTable({
                startY: 41,
                head: [['No', 'Satuan Kerja / Unit', 'Total Masuk', 'Pending / Draft', 'Disetujui / Proses', 'Final Selesai', 'Ditolak', 'Estimasi Anggaran']],
                body: procSubmittedRows.length > 0 ? procSubmittedRows : [['-', 'Tidak ada pengajuan pengadaan pada rentang tanggal ini', '0', '0', '0', '0', '0', 'Rp 0']],
                theme: 'striped',
                headStyles: { fillColor: [14, 116, 144], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
                bodyStyles: { fontSize: 7.5, cellPadding: 2.5 },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 10 },
                    1: { halign: 'left', cellWidth: 80 },
                    2: { halign: 'center', cellWidth: 30, fontStyle: 'bold' },
                    3: { halign: 'center', cellWidth: 26 },
                    4: { halign: 'center', cellWidth: 32 },
                    5: { halign: 'center', cellWidth: 26, fontStyle: 'bold' },
                    6: { halign: 'center', cellWidth: 20 },
                    7: { halign: 'right', cellWidth: 45, fontStyle: 'bold' }
                }
            });

            const afterProcTable = doc.lastAutoTable ? doc.lastAutoTable.finalY : 70;

            // Rincian Jenis Barang yang Dibeli
            doc.setFontSize(9.5);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text('2. Jenis Barang yang Dibeli / Direalisasikan dalam Rentang Tanggal', 14, afterProcTable + 8);

            const purchasedItemRows = (procurementSummary.purchasedItems || []).map((item, i) => [
                i + 1,
                item.procurementCode || '-',
                item.name,
                item.spec || item.brand || '-',
                `${item.qty || 1} ${item.unit || 'Unit'}`,
                item.unitName || '-',
                item.vendor || '-',
                `Rp ${(item.price || 0).toLocaleString('id-ID')}`,
                `Rp ${(item.totalPrice || 0).toLocaleString('id-ID')}`
            ]);

            callAutoTable({
                startY: afterProcTable + 11,
                head: [['No', 'Kode Pengadaan', 'Nama Barang', 'Spesifikasi / Merk', 'Jumlah', 'Unit Pemohon', 'Vendor / Rekanan', 'Harga Satuan', 'Total Harga']],
                body: purchasedItemRows.length > 0 ? purchasedItemRows : [['-', '-', 'Tidak ada data item barang yang dibeli pada rentang tanggal ini', '-', '-', '-', '-', '-', 'Rp 0']],
                theme: 'grid',
                headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
                bodyStyles: { fontSize: 7, cellPadding: 2 },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 8 },
                    1: { halign: 'center', cellWidth: 28 },
                    2: { halign: 'left', cellWidth: 55, fontStyle: 'bold' },
                    3: { halign: 'left', cellWidth: 45 },
                    4: { halign: 'center', cellWidth: 22 },
                    5: { halign: 'left', cellWidth: 35 },
                    6: { halign: 'left', cellWidth: 35 },
                    7: { halign: 'right', cellWidth: 20 },
                    8: { halign: 'right', cellWidth: 21, fontStyle: 'bold' }
                }
            });

            // -------------------------------------------------------------
            // HALAMAN 3: BAGIAN 3 - PEMELIHARAAN (KHUSUS TARGETDEPT SARPRAS)
            // -------------------------------------------------------------
            doc.addPage();
            applyHeader('LAPORAN EKSEKUTIF III: PEMELIHARAAN SARANA & PRASARANA (KHUSUS TARGETDEPT SARPRAS)');

            doc.setFontSize(9.5);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text('1. Tiket Pemeliharaan Sarpras Masuk per Unit (Hanya Unit yang Mengajukan / Pengajuan > 0)', 14, 38);

            const maintSubmittedRows = (maintenanceSummary.submittedByUnit || []).map((u, i) => [
                i + 1,
                u.unitName,
                `${u.totalRequests} Tiket`,
                `${u.completedCount || 0}`,
                `${u.inProgressCount || 0}`,
                `${u.pendingCount || 0}`,
                `${u.rejectedCount || 0}`,
                `Rp ${(u.totalCost || 0).toLocaleString('id-ID')}`
            ]);

            callAutoTable({
                startY: 41,
                head: [['No', 'Satuan Kerja / Unit', 'Total Tiket Masuk', 'Selesai Dikerjakan', 'Sedang Diproses', 'Menunggu Persetujuan', 'Ditolak', 'Total Biaya']],
                body: maintSubmittedRows.length > 0 ? maintSubmittedRows : [['-', 'Tidak ada pengajuan pemeliharaan Sarpras pada rentang tanggal ini', '0', '0', '0', '0', '0', 'Rp 0']],
                theme: 'striped',
                headStyles: { fillColor: [180, 83, 9], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
                bodyStyles: { fontSize: 7.5, cellPadding: 2.5 },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 10 },
                    1: { halign: 'left', cellWidth: 80 },
                    2: { halign: 'center', cellWidth: 32, fontStyle: 'bold' },
                    3: { halign: 'center', cellWidth: 32, fontStyle: 'bold' },
                    4: { halign: 'center', cellWidth: 30 },
                    5: { halign: 'center', cellWidth: 36 },
                    6: { halign: 'center', cellWidth: 20 },
                    7: { halign: 'right', cellWidth: 29, fontStyle: 'bold' }
                }
            });

            const afterMaintTable = doc.lastAutoTable ? doc.lastAutoTable.finalY : 70;

            // Rincian Pemeliharaan Sarpras yang Selesai Dikerjakan
            doc.setFontSize(9.5);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text('2. Rincian Pemeliharaan Sarpras yang Selesai Dikerjakan dalam Rentang Tanggal', 14, afterMaintTable + 8);

            const maintCompletedRows = (maintenanceSummary.completedList || []).map((m, i) => [
                i + 1,
                m.code,
                formatDateIndo(m.completionDate),
                m.unitName,
                m.title,
                m.actionTaken || '-',
                m.technician || '-',
                `Rp ${(m.cost || 0).toLocaleString('id-ID')}`
            ]);

            callAutoTable({
                startY: afterMaintTable + 11,
                head: [['No', 'Kode Tiket', 'Tgl Selesai', 'Unit Pemohon', 'Judul Pemeliharaan', 'Tindakan / Solusi Perbaikan', 'Teknisi / Rekanan', 'Biaya']],
                body: maintCompletedRows.length > 0 ? maintCompletedRows : [['-', '-', '-', '-', 'Tidak ada tiket servis Sarpras yang selesai pada rentang tanggal ini', '-', '-', 'Rp 0']],
                theme: 'grid',
                headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
                bodyStyles: { fontSize: 7, cellPadding: 2 },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 8 },
                    1: { halign: 'center', cellWidth: 26 },
                    2: { halign: 'center', cellWidth: 22 },
                    3: { halign: 'left', cellWidth: 40 },
                    4: { halign: 'left', cellWidth: 50, fontStyle: 'bold' },
                    5: { halign: 'left', cellWidth: 65 },
                    6: { halign: 'left', cellWidth: 33 },
                    7: { halign: 'right', cellWidth: 25, fontStyle: 'bold' }
                }
            });

            // -------------------------------------------------------------
            // BLOK PENGESAHAN / TANDA TANGAN (SIGNATURE BLOCK)
            // -------------------------------------------------------------
            const currentY = doc.lastAutoTable ? doc.lastAutoTable.finalY : 140;
            const signY = (currentY + 30 > pageH - 25) ? (doc.addPage(), applyHeader('PENGESAHAN LAPORAN EKSEKUTIF ASET'), 45) : currentY + 12;

            doc.setFontSize(8.5);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(30, 41, 59);

            const col1X = 40;
            const col2X = pageW - 75;

            // Left: Mengetahui / Mengesahkan (Digital TTE Kepala Bidang Sarana)
            const signBoxW = 68;
            const signBoxH = 24;
            const box1X = col1X - (signBoxW / 2);

            doc.setFontSize(8.5);
            doc.setFont(undefined, 'normal');
            doc.text('Mengetahui / Mengesahkan,', col1X, signY, { align: 'center' });
            doc.setFont(undefined, 'bold');
            doc.text('Kepala Bidang Sarana', col1X, signY + 4.5, { align: 'center' });

            // TTE Box
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(203, 213, 225);
            doc.setLineWidth(0.3);
            doc.roundedRect(box1X, signY + 7, signBoxW, signBoxH, 2, 2, 'FD');

            doc.setFillColor(16, 185, 129);
            doc.roundedRect(box1X + 1.5, signY + 8.5, 3, signBoxH - 3, 1, 1, 'F');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.8);
            doc.setTextColor(5, 150, 105);
            doc.text('DITANDATANGANI SECARA ELEKTRONIK (TTE)', box1X + 6.5, signY + 12.5);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.2);
            doc.setTextColor(71, 85, 105);
            doc.text('Dokumen Sah & Terverifikasi Sistem E-Office', box1X + 6.5, signY + 16.5);
            doc.text('Yayasan Dar el Iman Padang', box1X + 6.5, signY + 20);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(15, 23, 42);
            doc.text('Ravi Kurnia, S.T.', col1X, signY + 36, { align: 'center' });
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(71, 85, 105);
            doc.text('Kepala Bidang Sarana', col1X, signY + 40, { align: 'center' });

            // Right: Disusun oleh
            doc.setFontSize(8.5);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(30, 41, 59);
            doc.text('Padang, ' + now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }), col2X, signY, { align: 'center' });
            doc.text('Disusun & Diverifikasi oleh,', col2X, signY + 4.5, { align: 'center' });
            doc.setFont(undefined, 'bold');
            doc.text(`( ${currentUser?.name || 'Administrator Aset'} )`, col2X, signY + 36, { align: 'center' });
            doc.setFont(undefined, 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(71, 85, 105);
            doc.text('Admin Aset & Sarpras', col2X, signY + 40, { align: 'center' });

            // -------------------------------------------------------------
            // NOMOR HALAMAN OTOMATIS (PAGE X OF Y)
            // -------------------------------------------------------------
            const totalPages = doc.internal.getNumberOfPages();
            for (let p = 1; p <= totalPages; p++) {
                doc.setPage(p);
                doc.setFontSize(7.5);
                doc.setTextColor(148, 163, 184);
                doc.text(
                    `Dokumen Resmi Sistem Manajemen Aset Yayasan Dar El-Iman   •   Halaman ${p} dari ${totalPages}`,
                    pageW / 2,
                    pageH - 6,
                    { align: 'center' }
                );
            }

            // Simpan Dokumen
            const fileCleanStart = startDate.replace(/[^0-9]/g, '');
            const fileCleanEnd = endDate.replace(/[^0-9]/g, '');
            doc.save(`Laporan_Aset_Pengadaan_Sarpras_${fileCleanStart}_sd_${fileCleanEnd}.pdf`);
        } catch (err) {
            console.error('PDF Export Error:', err);
            alert('Gagal membuat PDF: ' + err.message);
        } finally {
            setExporting(false);
        }
    };

    // Chart Data: Top 10 Aset per Unit
    const topUnitAssetsChartData = useMemo(() => {
        return (assetSummary.assetsPerUnit || []).slice(0, 8).map(u => ({
            name: u.unitName.length > 18 ? u.unitName.substring(0, 16) + '...' : u.unitName,
            fullName: u.unitName,
            Total: u.totalAssets || 0,
            Baik: u.goodCount || 0,
            Rusak: (u.lightDamagedCount || 0) + (u.heavyDamagedCount || 0)
        }));
    }, [assetSummary.assetsPerUnit]);

    // Chart Data: Pengadaan Masuk vs Selesai
    const procChartData = useMemo(() => {
        return (procurementSummary.submittedByUnit || []).slice(0, 8).map(u => ({
            name: u.unitName.length > 18 ? u.unitName.substring(0, 16) + '...' : u.unitName,
            fullName: u.unitName,
            Masuk: u.totalSubmissions || 0,
            Final: u.completedCount || 0
        }));
    }, [procurementSummary.submittedByUnit]);

    // Chart Data: Sarpras Masuk vs Selesai
    const maintChartData = useMemo(() => {
        return (maintenanceSummary.submittedByUnit || []).slice(0, 8).map(u => ({
            name: u.unitName.length > 18 ? u.unitName.substring(0, 16) + '...' : u.unitName,
            fullName: u.unitName,
            Tiket: u.totalRequests || 0,
            Selesai: u.completedCount || 0
        }));
    }, [maintenanceSummary.submittedByUnit]);

    return (
        <div className="space-y-6">
            {/* =========================================================================
                CONTROL & FILTER TOOLBAR
            ========================================================================= */}
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
                                <CalendarRange size={20} />
                            </span>
                            <div>
                                <h2 className="text-lg font-black text-slate-800 tracking-tight">
                                    Laporan Rentang Tanggal Eksekutif
                                </h2>
                                <p className="text-xs text-slate-500 font-medium">
                                    Audit aset saat ini, pengadaan per unit, barang dibeli, dan pemeliharaan Sarpras periode terpilih.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                        <button
                            onClick={() => fetchReport()}
                            disabled={loading}
                            className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all disabled:opacity-50"
                            title="Segarkan Data"
                        >
                            <RefreshCw size={16} className={cn(loading && "animate-spin text-indigo-600")} />
                        </button>

                        <button
                            onClick={handleExportPDF}
                            disabled={exporting || loading || !data}
                            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 text-white px-5 py-2.5 rounded-2xl text-xs font-black shadow-md shadow-indigo-200 transition-all disabled:opacity-50"
                        >
                            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                            {exporting ? 'Menyiapkan PDF...' : 'Ekspor Laporan PDF'}
                        </button>
                    </div>
                </div>

                {/* Preset Buttons & Custom Pickers */}
                <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                        {[
                            { key: 'today', label: 'Hari Ini' },
                            { key: 'last_7_days', label: '7 Hari' },
                            { key: 'this_month', label: 'Bulan Ini' },
                            { key: 'last_month', label: 'Bulan Lalu' },
                            { key: 'last_30_days', label: '30 Hari' },
                            { key: 'custom', label: 'Kustom Tanggal' }
                        ].map((btn) => (
                            <button
                                key={btn.key}
                                onClick={() => handlePresetChange(btn.key)}
                                className={cn(
                                    "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all",
                                    preset === btn.key
                                        ? "bg-indigo-600 text-white shadow-sm"
                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                )}
                            >
                                {btn.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
                            <Calendar size={14} className="text-slate-400" />
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => {
                                    setPreset('custom');
                                    setStartDate(e.target.value);
                                }}
                                className="bg-transparent text-slate-800 font-bold focus:outline-none cursor-pointer"
                            />
                            <span className="text-slate-400 font-bold">s/d</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => {
                                    setPreset('custom');
                                    setEndDate(e.target.value);
                                }}
                                className="bg-transparent text-slate-800 font-bold focus:outline-none cursor-pointer"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* =========================================================================
                TOP STATISTIC CARDS (KPI OVERVIEW)
            ========================================================================= */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* KPI 1: Total Aset Menyeluruh */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            1. Jumlah Aset Saat Ini
                        </span>
                        <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
                            <Box size={18} />
                        </span>
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                        {(assetSummary.totalAssets || 0).toLocaleString('id-ID')}
                        <span className="text-xs font-bold text-slate-400 ml-1.5">Unit</span>
                    </h3>
                    <p className="text-[11px] font-semibold text-slate-500 mt-1">
                        Baik: <strong className="text-emerald-600">{(assetSummary.goodCount || 0).toLocaleString('id-ID')}</strong> •
                        Rusak: <strong className="text-rose-600">{((assetSummary.lightDamagedCount || 0) + (assetSummary.heavyDamagedCount || 0)).toLocaleString('id-ID')}</strong>
                    </p>
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 font-medium">Estimasi Nilai Total</span>
                        <span className="font-mono font-black text-indigo-700">Rp {(assetSummary.totalValue || 0).toLocaleString('id-ID')}</span>
                    </div>
                </div>

                {/* KPI 2: Pengadaan Masuk */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            2. Pengadaan Masuk (Periode)
                        </span>
                        <span className="p-2 rounded-xl bg-cyan-50 text-cyan-600">
                            <ShoppingCart size={18} />
                        </span>
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                        {procurementSummary.totalSubmitted || 0}
                        <span className="text-xs font-bold text-slate-400 ml-1.5">Pengajuan</span>
                    </h3>
                    <p className="text-[11px] font-semibold text-slate-500 mt-1">
                        Dari <strong className="text-cyan-700">{procurementSummary.submittedByUnit?.length || 0}</strong> Unit Kerja Terdaftar
                    </p>
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 font-medium">Estimasi Usulan</span>
                        <span className="font-mono font-black text-cyan-700">Rp {Math.round(totalProcurementBudget).toLocaleString('id-ID')}</span>
                    </div>
                </div>

                {/* KPI 3: Pengadaan Finalisasi Selesai */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            2. Pengadaan Finalisasi
                        </span>
                        <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                            <CheckCircle2 size={18} />
                        </span>
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                        {procurementSummary.totalFinalized || 0}
                        <span className="text-xs font-bold text-slate-400 ml-1.5">Selesai (BAST)</span>
                    </h3>
                    <p className="text-[11px] font-semibold text-slate-500 mt-1">
                        Total <strong className="text-emerald-700">{procurementSummary.purchasedItems?.length || 0}</strong> Jenis Barang Direalisasi
                    </p>
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 font-medium">Unit Terealisasi</span>
                        <span className="font-black text-emerald-700">{procurementSummary.finalizedByUnit?.length || 0} Unit Kerja</span>
                    </div>
                </div>

                {/* KPI 4: Pemeliharaan Sarpras */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                3. Pemeliharaan
                            </span>
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-amber-100 text-amber-800 uppercase">
                                Sarpras
                            </span>
                        </div>
                        <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
                            <Wrench size={18} />
                        </span>
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                        {maintenanceSummary.totalSubmitted || 0}
                        <span className="text-xs font-bold text-slate-400 ml-1.5">Tiket Masuk</span>
                    </h3>
                    <p className="text-[11px] font-semibold text-slate-500 mt-1">
                        Selesai: <strong className="text-emerald-600">{maintenanceSummary.totalCompleted || 0}</strong> •
                        Proses: <strong className="text-amber-600">{Math.max(0, (maintenanceSummary.totalSubmitted || 0) - (maintenanceSummary.totalCompleted || 0))}</strong>
                    </p>
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 font-medium">Biaya Servis Selesai</span>
                        <span className="font-mono font-black text-amber-700">Rp {Math.round(totalMaintenanceCompletedCost).toLocaleString('id-ID')}</span>
                    </div>
                </div>
            </div>

            {/* =========================================================================
                SECTION TABS (INTERACTIVE FILTERING FOR FAST NAVIGATION)
            ========================================================================= */}
            <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl w-fit border border-slate-200">
                {[
                    { key: 'all', label: 'Semua Laporan & Statistik', icon: Layers },
                    { key: 'assets', label: '1. Aset Saat Ini', icon: Box },
                    { key: 'procurement', label: '2. Pengadaan Masuk & Final', icon: ShoppingCart },
                    { key: 'items', label: 'Jenis Barang Dibeli', icon: Package },
                    { key: 'maintenance', label: '3. Pemeliharaan Sarpras', icon: Wrench }
                ].map((sec) => {
                    const Icon = sec.icon;
                    const isActive = activeSection === sec.key;
                    return (
                        <button
                            key={sec.key}
                            onClick={() => setActiveSection(sec.key)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                                isActive
                                    ? "bg-white text-indigo-700 shadow-sm"
                                    : "text-slate-600 hover:text-slate-900"
                            )}
                        >
                            <Icon size={14} className={isActive ? "text-indigo-600" : "text-slate-400"} />
                            {sec.label}
                        </button>
                    );
                })}
            </div>

            {/* =========================================================================
                VISUAL CHARTS (STATISTIK VISUAL JIKA DIPERLUKAN)
            ========================================================================= */}
            {(activeSection === 'all' || activeSection === 'assets') && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Chart 1: Distribusi Aset Top 8 Unit */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                                    Distribusi Aset Terbanyak (Top 8 Unit)
                                </h4>
                                <p className="text-[11px] text-slate-400 mt-0.5">Komposisi kondisi fisik per unit</p>
                            </div>
                            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                                <Box size={16} />
                            </span>
                        </div>
                        <div className="h-56 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={topUnitAssetsChartData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" angle={-25} textAnchor="end" tick={{ fontSize: 9, fill: '#64748b' }} interval={0} />
                                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1e293b', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }}
                                    />
                                    <Bar dataKey="Baik" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                                    <Bar dataKey="Rusak" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Chart 2: Pengadaan Masuk vs Selesai */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                                    Pengadaan: Masuk vs Finalisasi
                                </h4>
                                <p className="text-[11px] text-slate-400 mt-0.5">Aktivitas per unit yang mengajukan</p>
                            </div>
                            <span className="p-2 rounded-xl bg-cyan-50 text-cyan-600">
                                <ShoppingCart size={16} />
                            </span>
                        </div>
                        <div className="h-56 w-full">
                            {procChartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={procChartData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="name" angle={-25} textAnchor="end" tick={{ fontSize: 9, fill: '#64748b' }} interval={0} />
                                        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1e293b', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }}
                                        />
                                        <Bar dataKey="Masuk" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="Final" fill="#10b981" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                                    Tidak ada pengajuan pengadaan pada rentang ini
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Chart 3: Pemeliharaan Sarpras Masuk vs Selesai */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                                    Pemeliharaan Sarpras: Masuk vs Selesai
                                </h4>
                                <p className="text-[11px] text-slate-400 mt-0.5">Khusus targetdept SARPRAS</p>
                            </div>
                            <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
                                <Wrench size={16} />
                            </span>
                        </div>
                        <div className="h-56 w-full">
                            {maintChartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={maintChartData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="name" angle={-25} textAnchor="end" tick={{ fontSize: 9, fill: '#64748b' }} interval={0} />
                                        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1e293b', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }}
                                        />
                                        <Bar dataKey="Tiket" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="Selesai" fill="#10b981" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                                    Tidak ada tiket servis Sarpras pada rentang ini
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* =========================================================================
                BAGIAN 1: TABEL JUMLAH ASET SAAT INI (MENYELURUH & PER UNIT)
            ========================================================================= */}
            {(activeSection === 'all' || activeSection === 'assets') && (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                                Laporan 1
                            </span>
                            <h3 className="text-base font-black text-slate-800 tracking-tight mt-1">
                                Jumlah Aset Saat Ini (Total Menyeluruh & per Satuan Kerja)
                            </h3>
                            <p className="text-xs text-slate-500 font-medium">
                                Rekapitulasi fisik aset aktif, sebaran kondisi kelayakan, dan valuasi per unit kerja.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-400">Total Unit:</span>
                            <span className="px-3 py-1 bg-slate-100 rounded-xl text-xs font-black text-slate-800">
                                {assetSummary.assetsPerUnit?.length || 0} Satker Terdaftar
                            </span>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-slate-50/70 text-slate-500 font-black uppercase tracking-wider border-b border-slate-100 text-[10px]">
                                    <th className="py-3 px-4 text-center w-12">No</th>
                                    <th className="py-3 px-4">Kode</th>
                                    <th className="py-3 px-4">Nama Satuan Kerja / Unit</th>
                                    <th className="py-3 px-4 text-center">Total Aset</th>
                                    <th className="py-3 px-4 text-center text-emerald-600">Kondisi Baik</th>
                                    <th className="py-3 px-4 text-center text-amber-600">Rusak Ringan</th>
                                    <th className="py-3 px-4 text-center text-rose-600">Rusak Berat</th>
                                    <th className="py-3 px-4 text-right">Total Nilai Aset</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                {(assetSummary.assetsPerUnit || []).map((u, i) => (
                                    <tr key={u.unitId || i} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="py-3 px-4 text-center font-bold text-slate-400">{i + 1}</td>
                                        <td className="py-3 px-4 font-mono font-bold text-slate-600">{u.unitCode || '-'}</td>
                                        <td className="py-3 px-4 font-black text-slate-800">{u.unitName}</td>
                                        <td className="py-3 px-4 text-center">
                                            <span className="px-2.5 py-1 rounded-full font-black text-xs bg-indigo-50 text-indigo-700 font-mono">
                                                {(u.totalAssets || 0).toLocaleString('id-ID')}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-center font-bold font-mono text-emerald-600">
                                            {(u.goodCount || 0).toLocaleString('id-ID')}
                                        </td>
                                        <td className="py-3 px-4 text-center font-bold font-mono text-amber-600">
                                            {(u.lightDamagedCount || 0).toLocaleString('id-ID')}
                                        </td>
                                        <td className="py-3 px-4 text-center font-bold font-mono text-rose-600">
                                            {(u.heavyDamagedCount || 0).toLocaleString('id-ID')}
                                        </td>
                                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">
                                            Rp {(u.totalValue || 0).toLocaleString('id-ID')}
                                        </td>
                                    </tr>
                                ))}
                                {(!assetSummary.assetsPerUnit || assetSummary.assetsPerUnit.length === 0) && (
                                    <tr>
                                        <td colSpan={8} className="py-8 text-center text-slate-400 font-medium">
                                            Tidak ada data aset terdaftar pada sistem.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot className="bg-slate-50 font-black text-slate-800 border-t border-slate-200">
                                <tr>
                                    <td colSpan={3} className="py-3 px-4 text-right uppercase tracking-wider text-[11px]">
                                        Total Keseluruhan Aset Aktif:
                                    </td>
                                    <td className="py-3 px-4 text-center text-sm font-mono text-indigo-700">
                                        {(assetSummary.totalAssets || 0).toLocaleString('id-ID')} Unit
                                    </td>
                                    <td className="py-3 px-4 text-center text-emerald-700 font-mono">
                                        {(assetSummary.goodCount || 0).toLocaleString('id-ID')}
                                    </td>
                                    <td className="py-3 px-4 text-center text-amber-700 font-mono">
                                        {(assetSummary.lightDamagedCount || 0).toLocaleString('id-ID')}
                                    </td>
                                    <td className="py-3 px-4 text-center text-rose-700 font-mono">
                                        {(assetSummary.heavyDamagedCount || 0).toLocaleString('id-ID')}
                                    </td>
                                    <td className="py-3 px-4 text-right text-sm font-mono text-indigo-900">
                                        Rp {(assetSummary.totalValue || 0).toLocaleString('id-ID')}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}

            {/* =========================================================================
                BAGIAN 2: PENGADAAN (MASUK PER UNIT & FINALISASI PER UNIT)
                * STRICT CONSTRAINT: UNIT YANG PENGAJUANNYA 0 TIDAK DITAMPILKAN *
            ========================================================================= */}
            {(activeSection === 'all' || activeSection === 'procurement') && (
                <div className="space-y-6">
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-wider text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-full">
                                    Laporan 2A
                                </span>
                                <h3 className="text-base font-black text-slate-800 tracking-tight mt-1">
                                    Pengadaan: Pengajuan Masuk & Status per Unit ({periodLabel})
                                </h3>
                                <p className="text-xs text-slate-500 font-medium">
                                    Menampilkan hanya unit kerja yang melakukan pengajuan. Unit tanpa pengajuan (0) otomatis disembunyikan.
                                </p>
                            </div>
                            <span className="px-3 py-1 bg-cyan-50 text-cyan-700 rounded-xl text-xs font-black">
                                {procurementSummary.submittedByUnit?.length || 0} Unit Mengajukan
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/70 text-slate-500 font-black uppercase tracking-wider border-b border-slate-100 text-[10px]">
                                        <th className="py-3 px-4 text-center w-12">No</th>
                                        <th className="py-3 px-4">Satuan Kerja / Unit</th>
                                        <th className="py-3 px-4 text-center">Total Masuk</th>
                                        <th className="py-3 px-4 text-center text-slate-600">Pending / Validasi</th>
                                        <th className="py-3 px-4 text-center text-blue-600">Disetujui / Order</th>
                                        <th className="py-3 px-4 text-center text-emerald-600 font-black">Selesai (Final BAST)</th>
                                        <th className="py-3 px-4 text-center text-rose-600">Ditolak</th>
                                        <th className="py-3 px-4 text-right">Estimasi Usulan</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                    {(procurementSummary.submittedByUnit || []).map((u, i) => (
                                        <tr key={u.unitId || i} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="py-3 px-4 text-center font-bold text-slate-400">{i + 1}</td>
                                            <td className="py-3 px-4 font-black text-slate-800">{u.unitName}</td>
                                            <td className="py-3 px-4 text-center">
                                                <span className="px-2.5 py-1 rounded-full font-black text-xs bg-cyan-50 text-cyan-700 font-mono">
                                                    {u.totalSubmissions} Pengajuan
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-center font-mono font-bold text-slate-600">{u.pendingCount || 0}</td>
                                            <td className="py-3 px-4 text-center font-mono font-bold text-blue-600">{u.processCount || 0}</td>
                                            <td className="py-3 px-4 text-center font-mono font-black text-emerald-600 bg-emerald-50/50">
                                                {u.completedCount || 0}
                                            </td>
                                            <td className="py-3 px-4 text-center font-mono font-bold text-rose-600">{u.rejectedCount || 0}</td>
                                            <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">
                                                Rp {(u.totalEstBudget || 0).toLocaleString('id-ID')}
                                            </td>
                                        </tr>
                                    ))}
                                    {(!procurementSummary.submittedByUnit || procurementSummary.submittedByUnit.length === 0) && (
                                        <tr>
                                            <td colSpan={8} className="py-8 text-center text-slate-400 font-medium">
                                                Alhamdulillah, tidak ada pengajuan pengadaan yang masuk pada rentang tanggal ini.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                {procurementSummary.submittedByUnit?.length > 0 && (
                                    <tfoot className="bg-slate-50 font-black text-slate-800 border-t border-slate-200">
                                        <tr>
                                            <td colSpan={2} className="py-3 px-4 text-right uppercase tracking-wider text-[11px]">
                                                Total Pengajuan Masuk Periode:
                                            </td>
                                            <td className="py-3 px-4 text-center text-sm font-mono text-cyan-800">
                                                {procurementSummary.totalSubmitted} Pengajuan
                                            </td>
                                            <td colSpan={3} className="py-3 px-4 text-center text-emerald-700 font-mono">
                                                Total Final BAST: {procurementSummary.totalFinalized}
                                            </td>
                                            <td className="py-3 px-4"></td>
                                            <td className="py-3 px-4 text-right text-sm font-mono text-slate-900">
                                                Rp {Math.round(totalProcurementBudget).toLocaleString('id-ID')}
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>

                    {/* Finalisasi Pengadaan per Unit */}
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                    Laporan 2B
                                </span>
                                <h3 className="text-base font-black text-slate-800 tracking-tight mt-1">
                                    Pengadaan Selesai Sampai Tahap Finalisasi (BAST) per Unit
                                </h3>
                                <p className="text-xs text-slate-500 font-medium">
                                    Daftar satuan kerja yang pengadaannya telah selesai 100% dan terbit Berita Acara Serah Terima (BAST).
                                </p>
                            </div>
                            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-black">
                                {procurementSummary.totalFinalized} Pengajuan Selesai
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/70 text-slate-500 font-black uppercase tracking-wider border-b border-slate-100 text-[10px]">
                                        <th className="py-3 px-4 text-center w-12">No</th>
                                        <th className="py-3 px-4">Satuan Kerja / Unit</th>
                                        <th className="py-3 px-4 text-center">Pengajuan Selesai Final</th>
                                        <th className="py-3 px-4 text-right">Total Nilai Realisasi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                    {(procurementSummary.finalizedByUnit || []).map((u, i) => (
                                        <tr key={u.unitId || i} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="py-3 px-4 text-center font-bold text-slate-400">{i + 1}</td>
                                            <td className="py-3 px-4 font-black text-slate-800">{u.unitName}</td>
                                            <td className="py-3 px-4 text-center">
                                                <span className="px-2.5 py-1 rounded-full font-black text-xs bg-emerald-50 text-emerald-700 font-mono">
                                                    {u.finalizedCount} Pengadaan Final
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">
                                                Rp {(u.totalFinalValue || 0).toLocaleString('id-ID')}
                                            </td>
                                        </tr>
                                    ))}
                                    {(!procurementSummary.finalizedByUnit || procurementSummary.finalizedByUnit.length === 0) && (
                                        <tr>
                                            <td colSpan={4} className="py-8 text-center text-slate-400 font-medium">
                                                Tidak ada pengadaan yang difinalisasi (BAST) pada rentang tanggal ini.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* =========================================================================
                BAGIAN 2C: JENIS BARANG YANG DIBELI
            ========================================================================= */}
            {(activeSection === 'all' || activeSection === 'items') && (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                                Laporan 2C
                            </span>
                            <h3 className="text-base font-black text-slate-800 tracking-tight mt-1">
                                Rincian Jenis Barang yang Dibeli / Direalisasikan ({periodLabel})
                            </h3>
                            <p className="text-xs text-slate-500 font-medium">
                                Daftar item belanja dari pengadaan yang dibuat, diproses, atau diselesaikan pada rentang periode.
                            </p>
                        </div>

                        {/* Search Input */}
                        <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-2xl border border-slate-200 text-xs w-full md:w-72">
                            <Search size={15} className="text-slate-400" />
                            <input
                                type="text"
                                placeholder="Cari nama barang / vendor / unit..."
                                value={itemSearch}
                                onChange={(e) => setItemSearch(e.target.value)}
                                className="bg-transparent text-slate-800 font-medium focus:outline-none w-full"
                            />
                            {itemSearch && (
                                <button onClick={() => setItemSearch('')} className="text-slate-400 hover:text-slate-600">
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-slate-50/70 text-slate-500 font-black uppercase tracking-wider border-b border-slate-100 text-[10px]">
                                    <th className="py-3 px-4 text-center w-12">No</th>
                                    <th className="py-3 px-4">Kode</th>
                                    <th className="py-3 px-4">Nama Barang</th>
                                    <th className="py-3 px-4">Spesifikasi / Merk</th>
                                    <th className="py-3 px-4 text-center">Jumlah</th>
                                    <th className="py-3 px-4">Unit Pemohon</th>
                                    <th className="py-3 px-4">Vendor / Rekanan</th>
                                    <th className="py-3 px-4 text-right">Harga Satuan</th>
                                    <th className="py-3 px-4 text-right">Total Harga</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                {filteredPurchasedItems.map((item, i) => (
                                    <tr key={item.id || i} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="py-3 px-4 text-center font-bold text-slate-400">{i + 1}</td>
                                        <td className="py-3 px-4 font-mono font-bold text-indigo-700">{item.procurementCode}</td>
                                        <td className="py-3 px-4 font-black text-slate-800">{item.name}</td>
                                        <td className="py-3 px-4 text-slate-500 text-[11px] max-w-xs truncate" title={item.spec || item.brand}>
                                            {item.spec || item.brand || '-'}
                                        </td>
                                        <td className="py-3 px-4 text-center font-bold font-mono">
                                            {item.qty} {item.unit}
                                        </td>
                                        <td className="py-3 px-4 font-medium text-slate-600">{item.unitName}</td>
                                        <td className="py-3 px-4 text-slate-500">{item.vendor}</td>
                                        <td className="py-3 px-4 text-right font-mono text-slate-600">
                                            Rp {(item.price || 0).toLocaleString('id-ID')}
                                        </td>
                                        <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                                            Rp {(item.totalPrice || 0).toLocaleString('id-ID')}
                                        </td>
                                    </tr>
                                ))}
                                {filteredPurchasedItems.length === 0 && (
                                    <tr>
                                        <td colSpan={9} className="py-8 text-center text-slate-400 font-medium">
                                            {itemSearch ? 'Tidak ada jenis barang yang cocok dengan pencarian.' : 'Tidak ada jenis barang yang dibeli pada rentang tanggal ini.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* =========================================================================
                BAGIAN 3: PEMELIHARAAN (TARGETDEPT: 'SARPRAS' SAJA)
                * STRICT CONSTRAINT: HANYA TARGETDEPT SARPRAS & UNIT 0 DISEMBUNYIKAN *
            ========================================================================= */}
            {(activeSection === 'all' || activeSection === 'maintenance') && (
                <div className="space-y-6">
                    {/* Tiket Masuk Sarpras per Unit */}
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <div className="flex items-center gap-1.5 mb-1">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                                        Laporan 3A
                                    </span>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
                                        Khusus Targetdept Sarpras
                                    </span>
                                </div>
                                <h3 className="text-base font-black text-slate-800 tracking-tight">
                                    Pemeliharaan Sarpras: Pengajuan Masuk per Unit ({periodLabel})
                                </h3>
                                <p className="text-xs text-slate-500 font-medium">
                                    Hanya menampilkan unit kerja yang mengajukan tiket servis Sarpras. Unit dengan tiket 0 otomatis disembunyikan.
                                </p>
                            </div>
                            <span className="px-3 py-1 bg-amber-50 text-amber-800 rounded-xl text-xs font-black">
                                {maintenanceSummary.submittedByUnit?.length || 0} Unit Mengajukan Tiket
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/70 text-slate-500 font-black uppercase tracking-wider border-b border-slate-100 text-[10px]">
                                        <th className="py-3 px-4 text-center w-12">No</th>
                                        <th className="py-3 px-4">Satuan Kerja / Unit</th>
                                        <th className="py-3 px-4 text-center">Total Tiket Masuk</th>
                                        <th className="py-3 px-4 text-center text-emerald-600 font-black">Selesai Dikerjakan</th>
                                        <th className="py-3 px-4 text-center text-amber-600">Sedang Dikerjakan</th>
                                        <th className="py-3 px-4 text-center text-slate-600">Menunggu</th>
                                        <th className="py-3 px-4 text-center text-rose-600">Ditolak</th>
                                        <th className="py-3 px-4 text-right">Total Biaya Perbaikan</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                    {(maintenanceSummary.submittedByUnit || []).map((u, i) => (
                                        <tr key={u.unitId || i} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="py-3 px-4 text-center font-bold text-slate-400">{i + 1}</td>
                                            <td className="py-3 px-4 font-black text-slate-800">{u.unitName}</td>
                                            <td className="py-3 px-4 text-center">
                                                <span className="px-2.5 py-1 rounded-full font-black text-xs bg-amber-50 text-amber-800 font-mono">
                                                    {u.totalRequests} Tiket
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-center font-mono font-black text-emerald-600 bg-emerald-50/50">
                                                {u.completedCount || 0}
                                            </td>
                                            <td className="py-3 px-4 text-center font-mono font-bold text-amber-600">
                                                {u.inProgressCount || 0}
                                            </td>
                                            <td className="py-3 px-4 text-center font-mono font-bold text-slate-600">
                                                {u.pendingCount || 0}
                                            </td>
                                            <td className="py-3 px-4 text-center font-mono font-bold text-rose-600">
                                                {u.rejectedCount || 0}
                                            </td>
                                            <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">
                                                Rp {(u.totalCost || 0).toLocaleString('id-ID')}
                                            </td>
                                        </tr>
                                    ))}
                                    {(!maintenanceSummary.submittedByUnit || maintenanceSummary.submittedByUnit.length === 0) && (
                                        <tr>
                                            <td colSpan={8} className="py-8 text-center text-slate-400 font-medium">
                                                Alhamdulillah, tidak ada pengajuan pemeliharaan Sarpras yang masuk pada rentang tanggal ini.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                {maintenanceSummary.submittedByUnit?.length > 0 && (
                                    <tfoot className="bg-slate-50 font-black text-slate-800 border-t border-slate-200">
                                        <tr>
                                            <td colSpan={2} className="py-3 px-4 text-right uppercase tracking-wider text-[11px]">
                                                Total Tiket Sarpras Masuk:
                                            </td>
                                            <td className="py-3 px-4 text-center text-sm font-mono text-amber-900">
                                                {maintenanceSummary.totalSubmitted} Tiket
                                            </td>
                                            <td colSpan={4} className="py-3 px-4 text-center text-emerald-700 font-mono">
                                                Total Selesai: {maintenanceSummary.totalCompleted} Tiket
                                            </td>
                                            <td className="py-3 px-4 text-right text-sm font-mono text-slate-900">
                                                Rp {Math.round(totalMaintenanceCompletedCost).toLocaleString('id-ID')}
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>

                    {/* Rincian Pemeliharaan Sarpras Selesai Dikerjakan */}
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-1.5 mb-1">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                                        Laporan 3B
                                    </span>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
                                        Khusus Targetdept Sarpras
                                    </span>
                                </div>
                                <h3 className="text-base font-black text-slate-800 tracking-tight">
                                    Pemeliharaan Sarpras yang Selesai Dikerjakan ({periodLabel})
                                </h3>
                                <p className="text-xs text-slate-500 font-medium">
                                    Rincian tindakan servis, penanganan teknisi, dan realisasi biaya yang selesai dikerjakan pada rentang tanggal.
                                </p>
                            </div>

                            {/* Search Completed Maintenance */}
                            <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-2xl border border-slate-200 text-xs w-full md:w-72">
                                <Search size={15} className="text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Cari tiket / teknisi / tindakan..."
                                    value={maintSearch}
                                    onChange={(e) => setMaintSearch(e.target.value)}
                                    className="bg-transparent text-slate-800 font-medium focus:outline-none w-full"
                                />
                                {maintSearch && (
                                    <button onClick={() => setMaintSearch('')} className="text-slate-400 hover:text-slate-600">
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/70 text-slate-500 font-black uppercase tracking-wider border-b border-slate-100 text-[10px]">
                                        <th className="py-3 px-4 text-center w-12">No</th>
                                        <th className="py-3 px-4">Kode Tiket</th>
                                        <th className="py-3 px-4">Tgl Selesai</th>
                                        <th className="py-3 px-4">Unit Pemohon</th>
                                        <th className="py-3 px-4">Judul Servis</th>
                                        <th className="py-3 px-4">Tindakan / Solusi Perbaikan</th>
                                        <th className="py-3 px-4">Teknisi / Rekanan</th>
                                        <th className="py-3 px-4 text-right">Biaya Servis</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                    {filteredCompletedMaint.map((m, i) => (
                                        <tr key={m.id || i} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="py-3 px-4 text-center font-bold text-slate-400">{i + 1}</td>
                                            <td className="py-3 px-4 font-mono font-bold text-amber-700">{m.code}</td>
                                            <td className="py-3 px-4 font-mono text-[11px] text-slate-600">{formatDateIndo(m.completionDate)}</td>
                                            <td className="py-3 px-4 font-black text-slate-800">{m.unitName}</td>
                                            <td className="py-3 px-4 font-bold text-slate-800 max-w-xs truncate" title={m.title}>
                                                {m.title}
                                            </td>
                                            <td className="py-3 px-4 text-slate-600 text-[11px] max-w-xs truncate" title={m.actionTaken}>
                                                {m.actionTaken || '-'}
                                            </td>
                                            <td className="py-3 px-4 text-slate-600">{m.technician || '-'}</td>
                                            <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                                                Rp {(m.cost || 0).toLocaleString('id-ID')}
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredCompletedMaint.length === 0 && (
                                        <tr>
                                            <td colSpan={8} className="py-8 text-center text-slate-400 font-medium">
                                                {maintSearch ? 'Tidak ada tiket servis yang cocok dengan pencarian.' : 'Tidak ada tiket pemeliharaan Sarpras yang selesai dikerjakan pada rentang tanggal ini.'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
