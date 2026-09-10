import React, { useState, useEffect } from 'react';
import {
    FileText,
    Download,
    Filter,
    Calendar,
    Car,
    Fuel,
    Wrench,
    CheckCircle2,
    Clock,
    AlertTriangle,
    Sparkles,
    Loader2,
    DollarSign,
    TrendingUp,
    ShieldCheck,
    Navigation2,
    Activity,
    RefreshCw,
    Bus,
    User,
    MapPin,
    Phone
} from 'lucide-react';
import api from '../lib/axios';

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

const REPORT_TYPES = [
    {
        id: 'PERFORMANCE',
        label: 'Jarak & Efisiensi',
        sublabel: 'Jarak tempuh, rasio KM/L, utilisasi',
        icon: TrendingUp,
        color: 'text-indigo-600 bg-indigo-50 border-indigo-200'
    },
    {
        id: 'FUEL_LOGS',
        label: 'Pengisian Minyak & BBM',
        sublabel: 'Transaksi isi bensin, liter, biaya, struk',
        icon: Fuel,
        color: 'text-sky-600 bg-sky-50 border-sky-200'
    },
    {
        id: 'CHECKLISTS',
        label: 'Ceklis Kelaikan Kendaraan',
        sublabel: 'Inspeksi berkala, kondisi siap jalan',
        icon: CheckCircle2,
        color: 'text-teal-600 bg-teal-50 border-teal-200'
    },
    {
        id: 'SANCTIONS',
        label: 'Sanksi Perjalanan',
        sublabel: 'Akun dibekukan & riwayat pelanggaran',
        icon: AlertTriangle,
        color: 'text-rose-600 bg-rose-50 border-rose-200'
    },
    {
        id: 'MAINTENANCE',
        label: 'Servis & Bengkel',
        sublabel: 'Biaya perawatan rutin & darurat',
        icon: Wrench,
        color: 'text-amber-600 bg-amber-50 border-amber-200'
    },
    {
        id: 'BOOKINGS',
        label: 'Logbook Peminjaman',
        sublabel: 'Riwayat unit pemohon & jarak',
        icon: Navigation2,
        color: 'text-blue-600 bg-blue-50 border-blue-200'
    },
    {
        id: 'BUS_SCHEDULE',
        label: 'Jadwal Booking Bus',
        sublabel: 'Reservasi bus operasional & supir',
        icon: Bus,
        color: 'text-purple-600 bg-purple-50 border-purple-200'
    },
    {
        id: 'COMPLIANCE',
        label: 'Pajak, STNK & KIR',
        sublabel: 'Status jatuh tempo legalitas dokumen',
        icon: ShieldCheck,
        color: 'text-emerald-600 bg-emerald-50 border-emerald-200'
    }
];

export default function VehicleReportTab({ dashboardData, availableMonths = [], initialReportType = 'PERFORMANCE' }) {
    const [reportType, setReportType] = useState(initialReportType || 'PERFORMANCE');

    useEffect(() => {
        if (initialReportType) {
            setReportType(initialReportType);
        }
    }, [initialReportType]);

    const [selectedMonth, setSelectedMonth] = useState('summary'); // 'summary' or 'YYYY-MM'
    const [selectedVehicle, setSelectedVehicle] = useState('ALL');

    // Data states
    const [allVehicles, setAllVehicles] = useState([]);
    const [maintenanceLogs, setMaintenanceLogs] = useState([]);
    const [bookingLogs, setBookingLogs] = useState([]);
    const [busBookings, setBusBookings] = useState([]);
    const [fuelTransactions, setFuelTransactions] = useState([]);
    const [fuelSummary, setFuelSummary] = useState({});
    const [checklists, setChecklists] = useState([]);
    const [sanctionsData, setSanctionsData] = useState({ sanctionedUsers: [], violations: [] });
    const [loadingData, setLoadingData] = useState(false);

    // AI Analysis States
    const [aiAnalysis, setAiAnalysis] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [includeAiInPdf, setIncludeAiInPdf] = useState(true);

    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        fetchVehiclesList();
    }, []);

    useEffect(() => {
        if (reportType === 'MAINTENANCE' && maintenanceLogs.length === 0) {
            fetchMaintenanceLogs();
        }
        if (reportType === 'BOOKINGS' && bookingLogs.length === 0) {
            fetchBookingLogs();
        }
        if (reportType === 'BUS_SCHEDULE' && busBookings.length === 0) {
            fetchBusBookings();
        }
        if (reportType === 'FUEL_LOGS' && fuelTransactions.length === 0) {
            fetchFuelReport();
        }
        if (reportType === 'CHECKLISTS' && checklists.length === 0) {
            fetchChecklists();
        }
        if (reportType === 'SANCTIONS' && sanctionsData.sanctionedUsers.length === 0 && sanctionsData.violations.length === 0) {
            fetchSanctionsData();
        }
    }, [reportType]);

    const fetchVehiclesList = async () => {
        try {
            const res = await api.get('/vehicles');
            setAllVehicles(res.data || []);
        } catch (e) {
            console.error('Error fetching vehicles list:', e);
        }
    };

    const fetchMaintenanceLogs = async () => {
        try {
            setLoadingData(true);
            const res = await api.get('/vehicles/maintenance/all');
            setMaintenanceLogs(res.data || []);
        } catch (e) {
            console.error('Error fetching maintenance logs:', e);
        } finally {
            setLoadingData(false);
        }
    };

    const fetchBookingLogs = async () => {
        try {
            setLoadingData(true);
            const res = await api.get('/vehicles/booking/all?status=COMPLETED');
            setBookingLogs(res.data || []);
        } catch (e) {
            console.error('Error fetching booking logs:', e);
        } finally {
            setLoadingData(false);
        }
    };

    const fetchBusBookings = async () => {
        try {
            setLoadingData(true);
            const res = await api.get('/bus-bookings');
            setBusBookings(res.data || []);
        } catch (e) {
            console.error('Error fetching bus bookings:', e);
        } finally {
            setLoadingData(false);
        }
    };

    const fetchFuelReport = async () => {
        try {
            setLoadingData(true);
            const res = await api.get('/vehicles/reports/fuel');
            setFuelTransactions(res.data?.transactions || []);
            setFuelSummary(res.data?.summary || {});
        } catch (e) {
            console.error('Error fetching fuel report:', e);
        } finally {
            setLoadingData(false);
        }
    };

    const fetchChecklists = async () => {
        try {
            setLoadingData(true);
            const res = await api.get('/vehicle-checklists');
            setChecklists(res.data || []);
        } catch (e) {
            console.error('Error fetching checklists:', e);
        } finally {
            setLoadingData(false);
        }
    };

    const fetchSanctionsData = async () => {
        try {
            setLoadingData(true);
            const res = await api.get('/vehicles/reports/sanctions');
            setSanctionsData(res.data || { sanctionedUsers: [], violations: [] });
        } catch (e) {
            console.error('Error fetching sanctions data:', e);
        } finally {
            setLoadingData(false);
        }
    };

    // Trigger AI Analysis
    const handleRunAIAnalysis = async () => {
        try {
            setAiLoading(true);
            const periodLabel = selectedMonth === 'summary'
                ? 'Semua Periode (Ringkasan Keseluruhan)'
                : `Bulan ${selectedMonth}`;

            // Prepare bus summary if bus bookings exist
            const busSummary = (busBookings.length > 0 ? busBookings : (dashboardData?.upcomingBusBookings || []))
                .slice(0, 8)
                .map(b => `- ${b.vehicle?.name || 'Bus'} (${b.vehicle?.plateNumber || '-'}): ${new Date(b.startDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} s/d ${new Date(b.endDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} | Rute: ${b.destination} | Pemesan: ${b.requesterName || b.user?.name || '-'} (${b.unit || '-'}) | Supir: ${b.driver?.name || 'Belum Ditugaskan'} | Status: ${b.status}`)
                .join('\n');

            const res = await api.post('/vehicles/ai/analyze', {
                period: periodLabel,
                stats: dashboardData?.stats || {},
                vStats: dashboardData?.vStats || [],
                urgentActions: dashboardData?.urgentActions || [],
                busSummary: busSummary || ''
            });

            setAiAnalysis(res.data?.analysis || 'Tidak ada analisis yang dihasilkan.');
        } catch (err) {
            console.error('AI Analysis failed:', err);
            setAiAnalysis('Gagal mendapatkan analisis AI. Pastikan GEMINI_API_KEY terkonfigurasi dengan benar.');
        } finally {
            setAiLoading(false);
        }
    };

    // Filtered bus booking data
    const filteredBusBookings = busBookings.filter(b => {
        if (selectedVehicle !== 'ALL' && b.vehicleId?.toString() !== selectedVehicle) return false;
        if (selectedMonth !== 'summary') {
            const bMonth = new Date(b.startDate).toISOString().slice(0, 7);
            if (bMonth !== selectedMonth) return false;
        }
        return true;
    });

    // Filtered performance data (from dashboardData.vStats)
    const filteredPerformance = (dashboardData?.vStats || []).filter(v => {
        if (selectedVehicle !== 'ALL' && v.id?.toString() !== selectedVehicle && v.name !== selectedVehicle) return false;
        return true;
    });

    // Filtered maintenance data
    const filteredMaintenance = maintenanceLogs.filter(log => {
        if (selectedVehicle !== 'ALL' && log.vehicleId?.toString() !== selectedVehicle) return false;
        if (selectedMonth !== 'summary') {
            const logMonth = new Date(log.date).toISOString().slice(0, 7);
            if (logMonth !== selectedMonth) return false;
        }
        return true;
    });

    // Filtered booking data
    const filteredBookings = bookingLogs.filter(b => {
        if (selectedVehicle !== 'ALL' && b.vehicleId?.toString() !== selectedVehicle) return false;
        if (selectedMonth !== 'summary') {
            const bMonth = new Date(b.startDate).toISOString().slice(0, 7);
            if (bMonth !== selectedMonth) return false;
        }
        return true;
    });

    // Filtered compliance data
    const filteredCompliance = allVehicles.filter(v => {
        if (selectedVehicle !== 'ALL' && v.id?.toString() !== selectedVehicle) return false;
        return true;
    });

    // Filtered Fuel Transactions
    const filteredFuelTransactions = fuelTransactions.filter(t => {
        if (selectedVehicle !== 'ALL' && t.vehicle?.id?.toString() !== selectedVehicle) return false;
        if (selectedMonth !== 'summary') {
            const tMonth = new Date(t.date).toISOString().slice(0, 7);
            if (tMonth !== selectedMonth) return false;
        }
        return true;
    });

    // Filtered Checklists
    const filteredChecklists = checklists.filter(c => {
        if (selectedVehicle !== 'ALL' && c.vehicleId?.toString() !== selectedVehicle) return false;
        if (selectedMonth !== 'summary') {
            const cMonth = new Date(c.date).toISOString().slice(0, 7);
            if (cMonth !== selectedMonth) return false;
        }
        return true;
    });

    // Filtered Sanctions
    const filteredSanctionedUsers = sanctionsData.sanctionedUsers || [];
    const filteredViolations = (sanctionsData.violations || []).filter(v => {
        if (selectedMonth !== 'summary') {
            const vMonth = new Date(v.date).toISOString().slice(0, 7);
            if (vMonth !== selectedMonth) return false;
        }
        return true;
    });

    // --- PDF EXPORT FUNCTION ---
    const handleExportPDF = async () => {
        setExporting(true);
        try {
            const jsPDF = await loadJsPDF();
            const doc = new jsPDF('portrait', 'mm', 'a4');
            const pageW = doc.internal.pageSize.getWidth();
            const now = new Date();

            const periodLabel = selectedMonth === 'summary'
                ? 'Ringkasan Keseluruhan'
                : `Bulan ${new Date(selectedMonth + '-01').toLocaleString('id-ID', { month: 'long', year: 'numeric' })}`;
            const printDateStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

            // 1. KOP SURAT BIDANG SARANA
            doc.setFontSize(16);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text('BIDANG SARANA', pageW / 2, 16, { align: 'center' });

            const titles = {
                PERFORMANCE: 'LAPORAN KINERJA & EFISIENSI BIAYA OPERASIONAL ARMADA',
                FUEL_LOGS: 'LAPORAN PENGISIAN MINYAK & BBM OPERASIONAL ARMADA',
                CHECKLISTS: 'LAPORAN CEKLIS & KELAIKAN JALAN ARMADA KENDARAAN',
                SANCTIONS: 'LAPORAN SANKSI & PELANGGARAN PEMINJAMAN KENDARAAN',
                MAINTENANCE: 'LAPORAN PEMELIHARAAN & SERVIS KENDARAAN',
                BOOKINGS: 'LAPORAN LOGBOOK PERJALANAN & UTILISASI ARMADA',
                BUS_SCHEDULE: 'LAPORAN JADWAL OPERASIONAL & RESERVASI BUS',
                COMPLIANCE: 'LAPORAN KEPATUHAN DOKUMEN LEGALITAS (PAJAK, STNK & KIR)'
            };

            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(79, 70, 229);
            doc.text(titles[reportType] || 'LAPORAN ARMADA', pageW / 2, 23, { align: 'center' });

            doc.setFontSize(8.5);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(100, 116, 139);
            doc.text(`Periode: ${periodLabel}   |   Tanggal Cetak: ${printDateStr}`, pageW / 2, 29, { align: 'center' });

            // Line Separator
            doc.setDrawColor(203, 213, 225);
            doc.setLineWidth(0.6);
            doc.line(14, 32, pageW - 14, 32);

            let startY = 37;

            // 2. AI Summary in PDF if requested
            if (includeAiInPdf && aiAnalysis) {
                doc.setFontSize(10);
                doc.setFont(undefined, 'bold');
                doc.setTextColor(79, 70, 229);
                doc.text('Ringkasan Analisis AI (Bidang Sarana):', 14, startY);
                startY += 5;

                const cleanAi = aiAnalysis.replace(/[#*`_]/g, '').trim();
                const splitAi = doc.splitTextToSize(cleanAi, pageW - 28);
                doc.setFontSize(7.5);
                doc.setFont(undefined, 'normal');
                doc.setTextColor(51, 65, 85);
                
                // Print first 8 lines of AI analysis to save page space
                const linesToPrint = splitAi.slice(0, 10);
                doc.text(linesToPrint, 14, startY);
                startY += (linesToPrint.length * 3.8) + 4;
            }

            // 3. TABLE DATA BASED ON REPORT TYPE
            if (reportType === 'PERFORMANCE') {
                const head = [['#', 'Kendaraan', 'Plat', 'Total KM', 'Efisiensi', 'Utilisasi', 'Cost/KM', 'Biaya BBM']];
                const body = filteredPerformance.map((v, i) => [
                    i + 1,
                    v.name,
                    v.plate,
                    `${Math.round(v.totalKm || 0).toLocaleString('id-ID')} KM`,
                    `${(v.kml || 0).toFixed(1)} KM/L`,
                    `${(v.utilization || 0).toFixed(0)}%`,
                    `Rp ${Math.round(v.cpkm || 0).toLocaleString('id-ID')}`,
                    `Rp ${Math.round((v.fuelCpkm || 0) * (v.totalKm || 0)).toLocaleString('id-ID')}`
                ]);

                const totalKm = filteredPerformance.reduce((acc, v) => acc + (v.totalKm || 0), 0);
                const totalFuelCost = filteredPerformance.reduce((acc, v) => acc + ((v.fuelCpkm || 0) * (v.totalKm || 0)), 0);

                const foot = [['', 'TOTAL / RATA-RATA', '', `${Math.round(totalKm).toLocaleString('id-ID')} KM`, '-', '-', '-', `Rp ${Math.round(totalFuelCost).toLocaleString('id-ID')}`]];

                doc.autoTable({
                    startY,
                    head,
                    body,
                    foot,
                    theme: 'striped',
                    headStyles: { fillColor: [79, 70, 229], fontSize: 8, fontStyle: 'bold' },
                    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontSize: 8, fontStyle: 'bold' },
                    bodyStyles: { fontSize: 7.5 },
                    margin: { left: 14, right: 14 }
                });
            } else if (reportType === 'FUEL_LOGS') {
                const head = [['#', 'Tanggal', 'Kendaraan', 'Plat', 'Pengemudi / Pemohon', 'Unit', 'Liter', 'Biaya (Rp)', 'Odometer']];
                const body = filteredFuelTransactions.map((t, i) => [
                    i + 1,
                    new Date(t.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
                    t.vehicle?.name || '-',
                    t.vehicle?.plateNumber || '-',
                    t.driverName || '-',
                    t.unitName || '-',
                    `${(t.liters || 0).toFixed(1)} L`,
                    `Rp ${Math.round(t.cost || 0).toLocaleString('id-ID')}`,
                    t.odometer ? `${t.odometer.toLocaleString('id-ID')} KM` : '-'
                ]);

                const totalCost = filteredFuelTransactions.reduce((acc, t) => acc + (t.cost || 0), 0);
                const totalLiters = filteredFuelTransactions.reduce((acc, t) => acc + (t.liters || 0), 0);
                const foot = [['', 'TOTAL PENGISIAN BBM', '', '', '', '', `${totalLiters.toFixed(1)} L`, `Rp ${totalCost.toLocaleString('id-ID')}`, '']];

                doc.autoTable({
                    startY,
                    head,
                    body,
                    foot,
                    theme: 'striped',
                    headStyles: { fillColor: [2, 132, 199], fontSize: 8, fontStyle: 'bold' },
                    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontSize: 8, fontStyle: 'bold' },
                    bodyStyles: { fontSize: 7.5 },
                    margin: { left: 14, right: 14 }
                });
            } else if (reportType === 'CHECKLISTS') {
                const head = [['#', 'Tanggal', 'Kendaraan', 'Plat', 'Pemeriksa / Supir', 'Tipe Ceklis', 'Status Kelaikan', 'Catatan']];
                const body = filteredChecklists.map((c, i) => [
                    i + 1,
                    new Date(c.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
                    c.vehicle?.name || '-',
                    c.vehicle?.plateNumber || '-',
                    c.driver?.name || 'Staff Lapangan',
                    c.type || 'HARIAN',
                    c.status || 'SIAP JALAN',
                    c.notes || '-'
                ]);

                const readyCount = filteredChecklists.filter(c => c.status === 'SIAP JALAN').length;
                const foot = [['', `TOTAL CEKLIS: ${filteredChecklists.length} Unit`, '', '', '', '', `SIAP: ${readyCount} / ${filteredChecklists.length}`, '']];

                doc.autoTable({
                    startY,
                    head,
                    body,
                    foot,
                    theme: 'striped',
                    headStyles: { fillColor: [13, 148, 136], fontSize: 8, fontStyle: 'bold' },
                    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontSize: 8, fontStyle: 'bold' },
                    bodyStyles: { fontSize: 7.5 },
                    margin: { left: 14, right: 14 }
                });
            } else if (reportType === 'SANCTIONS') {
                const head = [['#', 'Nama Pengguna / Pengemudi', 'Jabatan & Unit', 'No HP', 'Status Akun', 'Alasan / Uraian Pelanggaran']];
                const activeRows = filteredSanctionedUsers.map((u, i) => [
                    i + 1,
                    u.name,
                    `${u.position || '-'} (${u.unit?.name || 'Umum'})`,
                    u.phone || '-',
                    u.sanctionProposedLift ? 'MENUNGGU REVIEW' : 'AKUN DIBEKUKAN',
                    u.sanctionLiftReason ? `Alasan usulan: ${u.sanctionLiftReason}` : 'Terkena sanksi otomatis perjalanan'
                ]);

                const violationRows = filteredViolations.map((v, i) => [
                    activeRows.length + i + 1,
                    v.driver?.name || '-',
                    `${v.driver?.position || '-'} (${v.driver?.unit?.name || 'Umum'})`,
                    v.driver?.phone || '-',
                    v.sanction || 'Teguran',
                    v.description || '-'
                ]);

                const combinedBody = [...activeRows, ...violationRows];

                doc.autoTable({
                    startY,
                    head,
                    body: combinedBody,
                    theme: 'striped',
                    headStyles: { fillColor: [225, 29, 72], fontSize: 8, fontStyle: 'bold' },
                    bodyStyles: { fontSize: 7.5 },
                    margin: { left: 14, right: 14 }
                });
            } else if (reportType === 'MAINTENANCE') {
                const head = [['#', 'Tanggal', 'Kendaraan', 'Bengkel', 'Kategori', 'Odometer', 'Biaya (Rp)']];
                const body = filteredMaintenance.map((m, i) => [
                    i + 1,
                    new Date(m.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
                    m.vehicle?.name || '-',
                    m.serviceCenter || '-',
                    m.category === 'ROUTINE' ? 'Servis Rutin' : 'Perbaikan',
                    `${(m.odometer || 0).toLocaleString('id-ID')} KM`,
                    `Rp ${(m.cost || 0).toLocaleString('id-ID')}`
                ]);

                const totalCost = filteredMaintenance.reduce((acc, m) => acc + (m.cost || 0), 0);
                const foot = [['', 'TOTAL BIAYA SERVIS', '', '', '', '', `Rp ${totalCost.toLocaleString('id-ID')}`]];

                doc.autoTable({
                    startY,
                    head,
                    body,
                    foot,
                    theme: 'striped',
                    headStyles: { fillColor: [217, 119, 6], fontSize: 8, fontStyle: 'bold' },
                    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontSize: 8, fontStyle: 'bold' },
                    bodyStyles: { fontSize: 7.5 },
                    margin: { left: 14, right: 14 }
                });
            } else if (reportType === 'BOOKINGS') {
                const head = [['#', 'Tanggal', 'Kendaraan', 'Peminjam', 'Tujuan', 'KM Berangkat', 'KM Kembali', 'Jarak']];
                const body = filteredBookings.map((b, i) => [
                    i + 1,
                    new Date(b.startDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
                    b.vehicle?.name || '-',
                    b.user?.name || b.user?.username || '-',
                    b.destination || '-',
                    b.startKm?.toLocaleString('id-ID') || '-',
                    b.endKm?.toLocaleString('id-ID') || '-',
                    `${((b.endKm || 0) - (b.startKm || 0)).toLocaleString('id-ID')} KM`
                ]);

                const totalKm = filteredBookings.reduce((acc, b) => acc + ((b.endKm || 0) - (b.startKm || 0)), 0);
                const foot = [['', 'TOTAL JARAK DITEMPUH', '', '', '', '', '', `${totalKm.toLocaleString('id-ID')} KM`]];

                doc.autoTable({
                    startY,
                    head,
                    body,
                    foot,
                    theme: 'striped',
                    headStyles: { fillColor: [37, 99, 235], fontSize: 8, fontStyle: 'bold' },
                    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontSize: 8, fontStyle: 'bold' },
                    bodyStyles: { fontSize: 7.5 },
                    margin: { left: 14, right: 14 }
                });
            } else if (reportType === 'BUS_SCHEDULE') {
                const head = [['#', 'Jadwal (Mulai - Selesai)', 'Armada Bus', 'Pemesan & Unit', 'Tujuan', 'Pnp', 'Driver', 'Status']];
                const body = filteredBusBookings.map((b, i) => {
                    const startStr = new Date(b.startDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
                    const endStr = new Date(b.endDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
                    const timeRange = startStr === endStr ? startStr : `${startStr} - ${endStr}`;
                    const requester = `${b.requesterName || b.user?.name || '-'} (${b.unit || b.user?.unit?.name || '-'})`;
                    const statusLabel = b.status === 'COMPLETED' ? 'SELESAI' : b.status === 'APPROVED' ? 'DISETUJUI' : b.status;

                    return [
                        i + 1,
                        timeRange,
                        `${b.vehicle?.name || '-'} (${b.vehicle?.plateNumber || '-'})`,
                        requester,
                        b.destination || '-',
                        `${b.passengerCount || 0} Org`,
                        b.driver?.name || 'Belum Ditugaskan',
                        statusLabel
                    ];
                });

                const totalPassenger = filteredBusBookings.reduce((acc, b) => acc + (b.passengerCount || 0), 0);
                const foot = [['', `TOTAL: ${filteredBusBookings.length} Reservasi`, '', '', '', `${totalPassenger} Org`, '', '']];

                doc.autoTable({
                    startY,
                    head,
                    body,
                    foot,
                    theme: 'striped',
                    headStyles: { fillColor: [147, 51, 234], fontSize: 8, fontStyle: 'bold' },
                    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontSize: 8, fontStyle: 'bold' },
                    bodyStyles: { fontSize: 7.5 },
                    margin: { left: 14, right: 14 }
                });
            } else if (reportType === 'COMPLIANCE') {
                const head = [['#', 'Kendaraan', 'Plat', 'Pajak Tahunan', 'STNK (5 Thn)', 'Uji KIR', 'Status']];
                const nowMs = new Date().getTime();
                const thirtyDays = 30 * 24 * 60 * 60 * 1000;

                const body = filteredCompliance.map((v, i) => {
                    const isOverdue = (v.taxDueDate && new Date(v.taxDueDate) < now) || (v.stnkDueDate && new Date(v.stnkDueDate) < now);
                    const isNear = (v.taxDueDate && (new Date(v.taxDueDate) - nowMs) < thirtyDays) || (v.stnkDueDate && (new Date(v.stnkDueDate) - nowMs) < thirtyDays);
                    const statusText = isOverdue ? 'JATUH TEMPO' : isNear ? 'MENDEKATI JATUH TEMPO' : 'TERPENUHI';

                    return [
                        i + 1,
                        v.name,
                        v.plateNumber,
                        v.taxDueDate ? new Date(v.taxDueDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-',
                        v.stnkDueDate ? new Date(v.stnkDueDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-',
                        v.kirDueDate ? new Date(v.kirDueDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Tidak Ada',
                        statusText
                    ];
                });

                doc.autoTable({
                    startY,
                    head,
                    body,
                    theme: 'striped',
                    headStyles: { fillColor: [5, 150, 105], fontSize: 8, fontStyle: 'bold' },
                    bodyStyles: { fontSize: 7.5 },
                    margin: { left: 14, right: 14 }
                });
            }

            // 4. SIGNATURES SECTION
            const lastY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 14 : startY + 20;
            let signY = lastY;

            if (signY > doc.internal.pageSize.getHeight() - 40) {
                doc.addPage();
                signY = 25;
            }

            doc.setFontSize(8.5);
            doc.setTextColor(51, 65, 85);
            doc.setFont(undefined, 'normal');

            // Left signature
            let picLabel = 'Penanggung Jawab Armada';
            if (reportType === 'BUS_SCHEDULE') picLabel = 'Penanggung Jawab Armada Bus';
            else if (reportType === 'FUEL_LOGS') picLabel = 'Penanggung Jawab BBM & Minyak';
            else if (reportType === 'CHECKLISTS') picLabel = 'Tim Pemeriksa Kelaikan Kendaraan';
            else if (reportType === 'SANCTIONS') picLabel = 'Penanggung Jawab Disiplin Armada';

            doc.text('Dibuat Oleh,', 25, signY);
            doc.text(picLabel, 25, signY + 5);
            doc.text('( ............................................. )', 25, signY + 26);

            // Right signature
            doc.text('Mengetahui,', pageW - 85, signY);
            doc.text('Kepala Bidang Sarana', pageW - 85, signY + 5);
            doc.text('( ............................................. )', pageW - 85, signY + 26);

            // 5. FOOTER (Page Numbering)
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(7.5);
                doc.setFont(undefined, 'normal');
                doc.setTextColor(148, 163, 184);
                doc.text(
                    `Halaman ${i} dari ${pageCount}  |  Bidang Sarana`,
                    pageW / 2,
                    doc.internal.pageSize.getHeight() - 8,
                    { align: 'center' }
                );
            }

            doc.save(`Laporan_${reportType}_Bidang_Sarana_${now.toISOString().slice(0, 10)}.pdf`);
        } catch (err) {
            console.error('PDF Export Error:', err);
            alert('Gagal mengekspor PDF: ' + err.message);
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Top Bar: Report Type Selector Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {REPORT_TYPES.map(t => {
                    const Icon = t.icon;
                    const isActive = reportType === t.id;
                    return (
                        <div
                            key={t.id}
                            onClick={() => setReportType(t.id)}
                            className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                                isActive
                                    ? 'bg-white border-indigo-600 shadow-md ring-2 ring-indigo-500/20'
                                    : 'bg-white/80 border-slate-200 hover:bg-white hover:border-slate-300 shadow-xs'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-2.5 rounded-xl border ${t.color}`}>
                                    <Icon size={20} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h4 className={`text-xs font-black truncate ${isActive ? 'text-indigo-900' : 'text-slate-800'}`}>
                                        {t.label}
                                    </h4>
                                    <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{t.sublabel}</p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Filter and Action Bar */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                    {/* Period Filter */}
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                        <Calendar size={15} className="text-slate-400" />
                        <select
                            value={selectedMonth}
                            onChange={e => setSelectedMonth(e.target.value)}
                            className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                        >
                            <option value="summary">📊 Semua Periode (Akumulasi)</option>
                            {availableMonths.map(m => (
                                <option key={m} value={m}>
                                    📅 {new Date(m + '-01').toLocaleString('id-ID', { month: 'long', year: 'numeric' })}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Vehicle Filter */}
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                        <Car size={15} className="text-slate-400" />
                        <select
                            value={selectedVehicle}
                            onChange={e => setSelectedVehicle(e.target.value)}
                            className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer max-w-[180px] truncate"
                        >
                            <option value="ALL">🚗 Semua Armada</option>
                            {allVehicles.map(v => (
                                <option key={v.id} value={v.id.toString()}>
                                    {v.name} ({v.plateNumber})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* AI Button */}
                    <button
                        onClick={handleRunAIAnalysis}
                        disabled={aiLoading}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-black shadow-md shadow-purple-200 transition-all disabled:opacity-50"
                    >
                        {aiLoading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                        {aiLoading ? 'Menganalisis...' : '✨ Analisis AI Armada'}
                    </button>

                    {/* PDF Export Button */}
                    <button
                        onClick={handleExportPDF}
                        disabled={exporting}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black shadow-md shadow-slate-300 transition-all disabled:opacity-50"
                    >
                        {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                        {exporting ? 'Membuat PDF...' : 'Unduh Laporan PDF (Bidang Sarana)'}
                    </button>
                </div>
            </div>

            {/* AI Insights Card (If generated) */}
            {aiAnalysis && (
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white p-6 shadow-xl border border-purple-500/30 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                        <div className="flex items-center gap-2 text-purple-300 font-extrabold text-xs tracking-wider uppercase">
                            <Sparkles size={18} className="text-purple-400" />
                            Hasil Analisis AI • Konsultan Efisiensi Bidang Sarana
                        </div>
                        <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={includeAiInPdf}
                                onChange={e => setIncludeAiInPdf(e.target.checked)}
                                className="rounded text-purple-600 focus:ring-purple-500"
                            />
                            Sertakan dalam PDF
                        </label>
                    </div>

                    <div className="text-xs text-slate-200 leading-relaxed space-y-2 whitespace-pre-wrap max-h-72 overflow-y-auto pr-2 custom-scrollbar">
                        {aiAnalysis}
                    </div>
                </div>
            )}

            {/* Live Preview Table */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                            <FileText size={16} className="text-indigo-600" />
                            Pratinjau Data: {REPORT_TYPES.find(r => r.id === reportType)?.label}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Kop Laporan: <strong>BIDANG SARANA</strong> • Periode: {selectedMonth === 'summary' ? 'Semua Periode' : selectedMonth}
                        </p>
                    </div>
                    <span className="text-xs font-bold text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200">
                        {reportType === 'PERFORMANCE' && `${filteredPerformance.length} Armada`}
                        {reportType === 'FUEL_LOGS' && `${filteredFuelTransactions.length} Transaksi BBM`}
                        {reportType === 'CHECKLISTS' && `${filteredChecklists.length} Ceklis Kelaikan`}
                        {reportType === 'SANCTIONS' && `${filteredSanctionedUsers.length} Disanksi / ${filteredViolations.length} Pelanggaran`}
                        {reportType === 'MAINTENANCE' && `${filteredMaintenance.length} Data Servis`}
                        {reportType === 'BOOKINGS' && `${filteredBookings.length} Perjalanan`}
                        {reportType === 'BUS_SCHEDULE' && `${filteredBusBookings.length} Reservasi Bus`}
                        {reportType === 'COMPLIANCE' && `${filteredCompliance.length} Unit Armada`}
                    </span>
                </div>

                <div className="overflow-x-auto">
                    {/* PERFORMANCE TABLE */}
                    {reportType === 'PERFORMANCE' && (
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                                <tr>
                                    <th className="p-3.5">#</th>
                                    <th className="p-3.5">Nama Kendaraan</th>
                                    <th className="p-3.5">Plat Nomor</th>
                                    <th className="p-3.5 text-right">Total Jarak (KM)</th>
                                    <th className="p-3.5 text-center">Efisiensi (KM/L)</th>
                                    <th className="p-3.5 text-center">Utilisasi</th>
                                    <th className="p-3.5 text-right">Biaya/KM</th>
                                    <th className="p-3.5 text-right">Total BBM (Rp)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700">
                                {filteredPerformance.map((v, i) => {
                                    const fuelTotal = (v.fuelCpkm || 0) * (v.totalKm || 0);
                                    return (
                                        <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="p-3.5 font-mono text-slate-400">{i + 1}</td>
                                            <td className="p-3.5 font-bold text-slate-900">{v.name}</td>
                                            <td className="p-3.5 font-mono text-slate-500">{v.plate}</td>
                                            <td className="p-3.5 text-right font-semibold">{Math.round(v.totalKm || 0).toLocaleString('id-ID')} KM</td>
                                            <td className="p-3.5 text-center">
                                                <span className={`px-2 py-0.5 rounded font-bold ${v.kml > 10 ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'}`}>
                                                    {(v.kml || 0).toFixed(1)} KM/L
                                                </span>
                                            </td>
                                            <td className="p-3.5 text-center font-medium">{(v.utilization || 0).toFixed(0)}%</td>
                                            <td className="p-3.5 text-right font-mono text-slate-600">Rp {Math.round(v.cpkm || 0).toLocaleString('id-ID')}</td>
                                            <td className="p-3.5 text-right font-mono font-bold text-slate-900">Rp {Math.round(fuelTotal).toLocaleString('id-ID')}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}

                    {/* FUEL LOGS TABLE */}
                    {reportType === 'FUEL_LOGS' && (
                        <div className="space-y-4">
                            {/* Fuel Quick KPI */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-sky-50/50 border-b border-sky-100">
                                <div className="p-3 bg-white rounded-xl border border-sky-100">
                                    <span className="text-[10px] font-black text-sky-600 uppercase tracking-widest block">Total Biaya BBM</span>
                                    <span className="text-lg font-black text-slate-800">
                                        Rp {Math.round(filteredFuelTransactions.reduce((acc, t) => acc + (t.cost || 0), 0)).toLocaleString('id-ID')}
                                    </span>
                                </div>
                                <div className="p-3 bg-white rounded-xl border border-sky-100">
                                    <span className="text-[10px] font-black text-sky-600 uppercase tracking-widest block">Total Liter Terisi</span>
                                    <span className="text-lg font-black text-slate-800">
                                        {filteredFuelTransactions.reduce((acc, t) => acc + (t.liters || 0), 0).toFixed(1)} Liter
                                    </span>
                                </div>
                                <div className="p-3 bg-white rounded-xl border border-sky-100">
                                    <span className="text-[10px] font-black text-sky-600 uppercase tracking-widest block">Total Transaksi</span>
                                    <span className="text-lg font-black text-slate-800">
                                        {filteredFuelTransactions.length} Pengisian
                                    </span>
                                </div>
                            </div>

                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                                    <tr>
                                        <th className="p-3.5">#</th>
                                        <th className="p-3.5">Tanggal</th>
                                        <th className="p-3.5">Kendaraan</th>
                                        <th className="p-3.5">Pengemudi / Pemohon</th>
                                        <th className="p-3.5">Unit</th>
                                        <th className="p-3.5 text-right">Liter</th>
                                        <th className="p-3.5 text-right">Biaya (Rp)</th>
                                        <th className="p-3.5 text-right">Odometer</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700">
                                    {filteredFuelTransactions.map((t, i) => (
                                        <tr key={t.id || i} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="p-3.5 font-mono text-slate-400">{i + 1}</td>
                                            <td className="p-3.5 whitespace-nowrap">
                                                {new Date(t.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </td>
                                            <td className="p-3.5">
                                                <div className="font-bold text-slate-900">{t.vehicle?.name || '-'}</div>
                                                <div className="text-[10px] font-mono font-bold text-slate-400">{t.vehicle?.plateNumber}</div>
                                            </td>
                                            <td className="p-3.5 font-medium text-slate-800">{t.driverName}</td>
                                            <td className="p-3.5 font-semibold text-sky-700">{t.unitName}</td>
                                            <td className="p-3.5 text-right font-mono font-bold text-slate-800">{(t.liters || 0).toFixed(1)} L</td>
                                            <td className="p-3.5 text-right font-mono font-black text-sky-600">Rp {Math.round(t.cost || 0).toLocaleString('id-ID')}</td>
                                            <td className="p-3.5 text-right font-mono text-slate-600">{t.odometer ? `${t.odometer.toLocaleString('id-ID')} KM` : '-'}</td>
                                        </tr>
                                    ))}
                                    {filteredFuelTransactions.length === 0 && (
                                        <tr>
                                            <td colSpan="8" className="p-8 text-center text-slate-400">Tidak ada data transaksi pengisian BBM pada filter ini.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* CHECKLISTS TABLE */}
                    {reportType === 'CHECKLISTS' && (
                        <div className="space-y-4">
                            {/* Checklist Quick KPI */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-teal-50/50 border-b border-teal-100">
                                <div className="p-3 bg-white rounded-xl border border-teal-100">
                                    <span className="text-[10px] font-black text-teal-600 uppercase tracking-widest block">Total Ceklis Masuk</span>
                                    <span className="text-lg font-black text-slate-800">{filteredChecklists.length} Inspeksi</span>
                                </div>
                                <div className="p-3 bg-white rounded-xl border border-teal-100">
                                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block">Siap Jalan</span>
                                    <span className="text-lg font-black text-emerald-700">
                                        {filteredChecklists.filter(c => c.status === 'SIAP JALAN').length} Unit
                                    </span>
                                </div>
                                <div className="p-3 bg-white rounded-xl border border-teal-100">
                                    <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest block">Perlu Perbaikan</span>
                                    <span className="text-lg font-black text-rose-700">
                                        {filteredChecklists.filter(c => c.status !== 'SIAP JALAN').length} Unit
                                    </span>
                                </div>
                            </div>

                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                                    <tr>
                                        <th className="p-3.5">#</th>
                                        <th className="p-3.5">Waktu Inspeksi</th>
                                        <th className="p-3.5">Kendaraan</th>
                                        <th className="p-3.5">Pemeriksa / Supir</th>
                                        <th className="p-3.5">Tipe</th>
                                        <th className="p-3.5 text-center">Status Kelaikan</th>
                                        <th className="p-3.5 text-center">Indikator BBM</th>
                                        <th className="p-3.5">Catatan / Temuan</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700">
                                    {filteredChecklists.map((c, i) => {
                                        const isReady = c.status === 'SIAP JALAN';
                                        return (
                                            <tr key={c.id || i} className="hover:bg-slate-50/60 transition-colors">
                                                <td className="p-3.5 font-mono text-slate-400">{i + 1}</td>
                                                <td className="p-3.5 whitespace-nowrap">
                                                    <div className="font-bold text-slate-800">{new Date(c.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</div>
                                                    <div className="text-[10px] font-mono text-slate-400">{new Date(c.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</div>
                                                </td>
                                                <td className="p-3.5">
                                                    <div className="font-bold text-slate-900">{c.vehicle?.name || '-'}</div>
                                                    <div className="text-[10px] font-mono text-slate-400 font-bold">{c.vehicle?.plateNumber}</div>
                                                </td>
                                                <td className="p-3.5 font-medium text-slate-800">{c.driver?.name || 'Staff Lapangan'}</td>
                                                <td className="p-3.5">
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                                                        {c.type || 'HARIAN'}
                                                    </span>
                                                </td>
                                                <td className="p-3.5 text-center">
                                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                        isReady ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                                    }`}>
                                                        {c.status || 'SIAP JALAN'}
                                                    </span>
                                                </td>
                                                <td className="p-3.5 text-center font-bold font-mono text-slate-600">
                                                    {c.fuelLevel || '-'}
                                                </td>
                                                <td className="p-3.5 text-slate-600 max-w-[220px] truncate" title={c.notes}>
                                                    {c.notes || '-'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filteredChecklists.length === 0 && (
                                        <tr>
                                            <td colSpan="8" className="p-8 text-center text-slate-400">Tidak ada riwayat ceklis kendaraan pada filter ini.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* SANCTIONS TABLE */}
                    {reportType === 'SANCTIONS' && (
                        <div className="p-6 space-y-6">
                            {/* Section 1: User Sedang Disanksi */}
                            <div>
                                <div className="flex items-center justify-between mb-3 pb-2 border-b border-rose-100">
                                    <h4 className="font-black text-rose-800 text-xs uppercase tracking-wider flex items-center gap-2">
                                        <AlertTriangle size={15} className="text-rose-600" />
                                        Daftar Pengguna yang Sedang Terkena Sanksi Perjalanan (Akun Dibekukan)
                                    </h4>
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800">
                                        {filteredSanctionedUsers.length} Orang Terkena Sanksi
                                    </span>
                                </div>

                                {filteredSanctionedUsers.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {filteredSanctionedUsers.map(u => (
                                            <div key={u.id} className="p-4 rounded-2xl border-2 border-rose-200 bg-rose-50/40 shadow-xs flex flex-col justify-between">
                                                <div>
                                                    <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-rose-200/60">
                                                        <span className="font-black text-slate-900 text-sm">{u.name}</span>
                                                        <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-rose-600 text-white uppercase tracking-wider">
                                                            Dibekukan
                                                        </span>
                                                    </div>
                                                    <div className="space-y-1 text-xs text-slate-600">
                                                        <div className="font-semibold text-slate-800">{u.position || 'Staff'} - {u.unit?.name || 'Umum'}</div>
                                                        <div className="text-[11px] font-mono text-slate-500">{u.phone || '-'}</div>
                                                        {u.sanctionLiftReason && (
                                                            <div className="mt-2 p-2 bg-white/80 rounded-lg text-[10px] text-slate-600 border border-rose-100">
                                                                <span className="font-bold text-rose-700 block">Usulan Pencabutan:</span>
                                                                {u.sanctionLiftReason}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="mt-3 pt-2 text-[10px] text-rose-700 font-bold">
                                                    Status: {u.sanctionProposedLift ? '⏳ Menunggu Review Pencabutan' : '🔒 Pembekuan Peminjaman Aktif'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-6 text-center bg-emerald-50 rounded-2xl border border-emerald-100">
                                        <CheckCircle2 size={24} className="text-emerald-500 mx-auto mb-1" />
                                        <p className="text-xs font-bold text-emerald-800">Alhamdulillah, tidak ada pengguna yang sedang terkena sanksi perjalanan.</p>
                                        <p className="text-[10px] text-emerald-600 mt-0.5">Semua pengguna dan peminjam armada dalam status aktif normal.</p>
                                    </div>
                                )}
                            </div>

                            {/* Section 2: Riwayat Log Pelanggaran Perjalanan */}
                            <div>
                                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                                    <h4 className="font-black text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
                                        <Clock size={15} className="text-slate-500" />
                                        Riwayat Catatan Pelanggaran Peminjaman Kendaraan
                                    </h4>
                                    <span className="text-[10px] text-slate-400 font-mono font-bold">
                                        {filteredViolations.length} Catatan
                                    </span>
                                </div>

                                <table className="w-full text-left text-xs border border-slate-100 rounded-xl overflow-hidden">
                                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                                        <tr>
                                            <th className="p-3">#</th>
                                            <th className="p-3">Tanggal</th>
                                            <th className="p-3">Pengemudi / Peminjam</th>
                                            <th className="p-3">Kategori</th>
                                            <th className="p-3">Sanksi</th>
                                            <th className="p-3">Uraian Kasus / Alasan</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-slate-700">
                                        {filteredViolations.map((v, i) => (
                                            <tr key={v.id || i} className="hover:bg-slate-50/60 transition-colors">
                                                <td className="p-3 font-mono text-slate-400">{i + 1}</td>
                                                <td className="p-3 whitespace-nowrap">
                                                    {new Date(v.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </td>
                                                <td className="p-3">
                                                    <div className="font-bold text-slate-900">{v.driver?.name || '-'}</div>
                                                    <div className="text-[10px] text-slate-500">{v.driver?.position || '-'}</div>
                                                </td>
                                                <td className="p-3 font-semibold text-rose-700">{v.category}</td>
                                                <td className="p-3">
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-700">
                                                        {v.sanction}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-slate-600 max-w-[280px]">
                                                    {v.description}
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredViolations.length === 0 && (
                                            <tr>
                                                <td colSpan="6" className="p-6 text-center text-slate-400">Tidak ada riwayat pelanggaran perjalanan yang tercatat.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* MAINTENANCE TABLE */}
                    {reportType === 'MAINTENANCE' && (
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                                <tr>
                                    <th className="p-3.5">#</th>
                                    <th className="p-3.5">Tanggal</th>
                                    <th className="p-3.5">Kendaraan</th>
                                    <th className="p-3.5">Bengkel</th>
                                    <th className="p-3.5">Kategori</th>
                                    <th className="p-3.5">Odometer</th>
                                    <th className="p-3.5 text-right">Biaya Servis (Rp)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700">
                                {filteredMaintenance.map((m, i) => (
                                    <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="p-3.5 font-mono text-slate-400">{i + 1}</td>
                                        <td className="p-3.5">{new Date(m.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                                        <td className="p-3.5 font-bold text-slate-900">{m.vehicle?.name || '-'} ({m.vehicle?.plateNumber || '-'})</td>
                                        <td className="p-3.5">{m.serviceCenter || '-'}</td>
                                        <td className="p-3.5">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${m.category === 'ROUTINE' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                                                {m.category === 'ROUTINE' ? 'Servis Rutin' : 'Perbaikan'}
                                            </span>
                                        </td>
                                        <td className="p-3.5 font-mono text-slate-600">{(m.odometer || 0).toLocaleString('id-ID')} KM</td>
                                        <td className="p-3.5 text-right font-mono font-bold text-slate-900">Rp {(m.cost || 0).toLocaleString('id-ID')}</td>
                                    </tr>
                                ))}
                                {filteredMaintenance.length === 0 && (
                                    <tr>
                                        <td colSpan="7" className="p-8 text-center text-slate-400">Tidak ada riwayat servis pada filter ini.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}

                    {/* BOOKINGS TABLE */}
                    {reportType === 'BOOKINGS' && (
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                                <tr>
                                    <th className="p-3.5">#</th>
                                    <th className="p-3.5">Tanggal</th>
                                    <th className="p-3.5">Kendaraan</th>
                                    <th className="p-3.5">Peminjam</th>
                                    <th className="p-3.5">Tujuan</th>
                                    <th className="p-3.5 text-right">KM Berangkat</th>
                                    <th className="p-3.5 text-right">KM Kembali</th>
                                    <th className="p-3.5 text-right">Jarak (KM)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700">
                                {filteredBookings.map((b, i) => (
                                    <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="p-3.5 font-mono text-slate-400">{i + 1}</td>
                                        <td className="p-3.5">{new Date(b.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</td>
                                        <td className="p-3.5 font-bold text-slate-900">{b.vehicle?.name || '-'}</td>
                                        <td className="p-3.5">{b.user?.name || b.user?.username || '-'}</td>
                                        <td className="p-3.5">{b.destination || '-'}</td>
                                        <td className="p-3.5 text-right font-mono">{b.startKm?.toLocaleString('id-ID') || '-'}</td>
                                        <td className="p-3.5 text-right font-mono">{b.endKm?.toLocaleString('id-ID') || '-'}</td>
                                        <td className="p-3.5 text-right font-mono font-bold text-indigo-600">
                                            {((b.endKm || 0) - (b.startKm || 0)).toLocaleString('id-ID')} KM
                                        </td>
                                    </tr>
                                ))}
                                {filteredBookings.length === 0 && (
                                    <tr>
                                        <td colSpan="8" className="p-8 text-center text-slate-400">Tidak ada riwayat perjalanan pada filter ini.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}

                    {/* BUS SCHEDULE TABLE */}
                    {reportType === 'BUS_SCHEDULE' && (
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                                <tr>
                                    <th className="p-3.5">#</th>
                                    <th className="p-3.5">Jadwal Keberangkatan</th>
                                    <th className="p-3.5">Armada Bus</th>
                                    <th className="p-3.5">Pemesan & Unit</th>
                                    <th className="p-3.5">Tujuan & Keperluan</th>
                                    <th className="p-3.5 text-center">Pnp</th>
                                    <th className="p-3.5">Driver / Supir</th>
                                    <th className="p-3.5 text-center">Status</th>
                                    <th className="p-3.5 text-right">Pembayaran</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700">
                                {filteredBusBookings.map((b, i) => {
                                    const startStr = new Date(b.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
                                    const endStr = new Date(b.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
                                    const isDone = b.status === 'COMPLETED';
                                    const isApproved = b.status === 'APPROVED';

                                    return (
                                        <tr key={b.id || i} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="p-3.5 font-mono text-slate-400">{i + 1}</td>
                                            <td className="p-3.5 whitespace-nowrap">
                                                <div className="font-bold text-slate-800">
                                                    {startStr} {startStr !== endStr ? `- ${endStr}` : ''}
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-mono">
                                                    {new Date(b.startDate).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                                                </div>
                                            </td>
                                            <td className="p-3.5">
                                                <div className="font-black text-slate-900 flex items-center gap-1.5">
                                                    <Bus size={13} className="text-purple-600" />
                                                    {b.vehicle?.name || '-'}
                                                </div>
                                                <div className="text-[10px] font-mono text-slate-400 font-bold">{b.vehicle?.plateNumber}</div>
                                            </td>
                                            <td className="p-3.5">
                                                <div className="font-bold text-slate-800">{b.requesterName || b.user?.name || '-'}</div>
                                                <div className="text-[10px] text-purple-700 font-bold">{b.unit || b.user?.unit?.name || 'Umum'}</div>
                                                {b.requesterPhone && (
                                                    <div className="text-[9px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                                                        <Phone size={9} /> {b.requesterPhone}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-3.5 max-w-[200px]">
                                                <div className="font-bold text-slate-800 flex items-center gap-1 truncate">
                                                    <MapPin size={11} className="text-slate-400 shrink-0" />
                                                    <span className="truncate">{b.destination || '-'}</span>
                                                </div>
                                                {b.purpose && (
                                                    <div className="text-[10px] text-slate-500 line-clamp-1 mt-0.5" title={b.purpose}>
                                                        {b.purpose}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-3.5 text-center font-bold text-slate-700">
                                                {b.passengerCount || 0} Org
                                            </td>
                                            <td className="p-3.5">
                                                {b.driver ? (
                                                    <div>
                                                        <span className="font-bold text-slate-800">{b.driver.name}</span>
                                                        {b.driver.phone && (
                                                            <div className="text-[9px] text-slate-400 font-mono">{b.driver.phone}</div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full">
                                                        Belum Ditugaskan
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3.5 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                    isDone ? 'bg-emerald-100 text-emerald-700' :
                                                    isApproved ? 'bg-blue-100 text-blue-700' :
                                                    'bg-slate-100 text-slate-600'
                                                }`}>
                                                    {b.status}
                                                </span>
                                            </td>
                                            <td className="p-3.5 text-right font-mono">
                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                                    b.isPaid ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                                                }`}>
                                                    {b.isPaid ? 'LUNAS' : 'BELUM'}
                                                </span>
                                                {b.totalBill > 0 && (
                                                    <div className="text-[10px] text-slate-500 font-bold mt-0.5">
                                                        Rp {Math.round(b.totalBill).toLocaleString('id-ID')}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredBusBookings.length === 0 && (
                                    <tr>
                                        <td colSpan="9" className="p-8 text-center text-slate-400">
                                            Tidak ada jadwal booking bus pada filter ini.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}

                    {/* COMPLIANCE TABLE */}
                    {reportType === 'COMPLIANCE' && (
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                                <tr>
                                    <th className="p-3.5">#</th>
                                    <th className="p-3.5">Nama Kendaraan</th>
                                    <th className="p-3.5">Plat Nomor</th>
                                    <th className="p-3.5">Pajak Tahunan</th>
                                    <th className="p-3.5">STNK (5 Tahunan)</th>
                                    <th className="p-3.5">Uji KIR</th>
                                    <th className="p-3.5 text-center">Status Legalitas</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700">
                                {filteredCompliance.map((v, i) => {
                                    const now = new Date();
                                    const isOverdue = (v.taxDueDate && new Date(v.taxDueDate) < now) || (v.stnkDueDate && new Date(v.stnkDueDate) < now);
                                    return (
                                        <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="p-3.5 font-mono text-slate-400">{i + 1}</td>
                                            <td className="p-3.5 font-bold text-slate-900">{v.name}</td>
                                            <td className="p-3.5 font-mono font-bold text-slate-600">{v.plateNumber}</td>
                                            <td className="p-3.5">
                                                {v.taxDueDate ? new Date(v.taxDueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                                            </td>
                                            <td className="p-3.5">
                                                {v.stnkDueDate ? new Date(v.stnkDueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                                            </td>
                                            <td className="p-3.5">
                                                {v.kirDueDate ? new Date(v.kirDueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Tidak Ada'}
                                            </td>
                                            <td className="p-3.5 text-center">
                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${isOverdue ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'}`}>
                                                    {isOverdue ? 'PERLU DIBAYAR' : 'AKTIF'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
