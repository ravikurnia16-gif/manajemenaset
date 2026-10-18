import { useState, useMemo } from 'react';
import {
    Car, Fuel, Bus, Wrench, DollarSign, Trophy, AlertTriangle, Clock,
    CheckCircle2, MapPin, User, Phone, ShieldAlert, Sparkles, Loader2,
    ChevronRight, Download, TrendingUp, BarChart3, Search, ArrowUpRight,
    Activity, CheckSquare, FileText, X, Copy, Check, Info, Award,
    Gauge, Camera
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Cell, PieChart, Pie, Legend
} from 'recharts';
import api from '../../../lib/axios';
import { getMediaUrl } from '../../../lib/media';

const COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#f97316'];

const formatInlineMarkdown = (text) => {
    if (!text) return '';
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code class="bg-slate-100 text-indigo-700 px-1 py-0.5 rounded text-[11px] font-mono">$1</code>');
};

const renderFormattedAiText = (text) => {
    if (!text) return null;
    const lines = text.split('\n');
    return (
        <div className="space-y-2 text-xs leading-relaxed text-slate-800">
            {lines.map((line, idx) => {
                const trimmed = line.trim();
                if (!trimmed) return <div key={idx} className="h-1" />;

                // Headings
                if (trimmed.startsWith('### ') || trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
                    const cleanTitle = trimmed.replace(/^#+\s*/, '');
                    return (
                        <h6 key={idx} className="font-black text-indigo-950 text-xs tracking-wide uppercase pt-3 pb-1 border-b border-indigo-100 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block"></span>
                            {cleanTitle}
                        </h6>
                    );
                }

                // Bullet points
                if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
                    const content = trimmed.substring(2);
                    return (
                        <div key={idx} className="flex items-start gap-2 pl-2">
                            <span className="text-indigo-600 font-bold mt-0.5">•</span>
                            <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(content) }} />
                        </div>
                    );
                }

                // Numbered lists
                const matchNum = trimmed.match(/^(\d+\.)\s*(.*)/);
                if (matchNum) {
                    return (
                        <div key={idx} className="flex items-start gap-2 pl-2">
                            <span className="text-indigo-700 font-black font-mono text-[11px] mt-0.5">{matchNum[1]}</span>
                            <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(matchNum[2]) }} />
                        </div>
                    );
                }

                return (
                    <p key={idx} dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(trimmed) }} />
                );
            })}
        </div>
    );
};

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

export default function VehicleSevenReportsSection({
    data,
    periodLabel,
    onNavigateToReport,
    currentUser,
    exportRef
}) {
    const [activeSubTab, setActiveSubTab] = useState('TRIPS'); // 'TRIPS', 'FUEL', 'BUS_BOOKINGS', 'MAINTENANCE', 'BUS_OMSET', 'DRIVERS', 'VIOLATIONS'
    const [searchQuery, setSearchQuery] = useState('');
    const [aiAnalysis, setAiAnalysis] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [showAiModal, setShowAiModal] = useState(false);
    const [copied, setCopied] = useState(false);
    const [exportingPdf, setExportingPdf] = useState(false);
    const [exportingDoc, setExportingDoc] = useState(false);
    const [previewPhoto, setPreviewPhoto] = useState(null);

    // Datasets from backend
    const activeTrips = useMemo(() => data?.activeVehicleTripStats || [], [data]);
    const activeFuels = useMemo(() => data?.activeVehicleFuelStats || [], [data]);
    const busBookings = useMemo(() => data?.busBookingStats || { total: 0, statusCounts: {}, totalPassengers: 0, byVehicle: [], bookings: [] }, [data]);
    const completedMaint = useMemo(() => data?.completedMaintenanceStats || { totalCount: 0, totalCost: 0, byType: [], byVehicle: [], services: [] }, [data]);
    const busOmset = useMemo(() => data?.busOmsetStats || { totalRevenue: 0, bookingRevenue: 0, otherIncome: 0, totalExpenses: 0, fuelExpenses: 0, maintenanceExpenses: 0, unexpectedExpenses: 0, sisaOmset: 0, marginPercent: 0, busUnitsCount: 0 }, [data]);
    const topDrivers = useMemo(() => data?.topDrivers || [], [data]);
    const violations = useMemo(() => data?.dateViolationsStats || {
        totalViolations: 0,
        discrepancyCount: 0,
        totalDiscrepancyKm: 0,
        sanctionedCount: 0,
        discrepancies: [],
        sanctionedUsers: []
    }, [data]);

    // Handle Dedicated 7 Reports PDF Export
    const handleExportSevenReportsPDF = async () => {
        try {
            setExportingPdf(true);
            const jsPDF = await loadJsPDF();
            const doc = new jsPDF('landscape', 'mm', 'a4');
            const pageW = doc.internal.pageSize.getWidth();
            const pageH = doc.internal.pageSize.getHeight();
            const now = new Date();
            const printDateStr = now.toLocaleDateString('id-ID', {
                day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            // ==============================================================
            // PAGE 1: KOP SURAT RESMI, RINGKASAN METRIK & LAPORAN 1
            // ==============================================================
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text('YAYASAN DAR EL IMAN', pageW / 2, 13, { align: 'center' });

            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(79, 70, 229);
            doc.text('BIDANG SARANA', pageW / 2, 18, { align: 'center' });

            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(15, 23, 42);
            doc.text('LAPORAN KHUSUS: 7 INDIKATOR UTAMA OPERASIONAL ARMADA', pageW / 2, 24, { align: 'center' });

            doc.setFontSize(8.5);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(100, 116, 139);
            doc.text(`Periode Data: ${periodLabel || 'Semua Periode'}   |   Waktu Cetak: ${printDateStr}`, pageW / 2, 29, { align: 'center' });

            doc.setDrawColor(203, 213, 225);
            doc.setLineWidth(0.5);
            doc.line(14, 32, pageW - 14, 32);

            // Ringkasan Eksekutif 7 Indikator
            const totActiveUnits = activeTrips.length;
            const totTrips = activeTrips.reduce((s, v) => s + (v.tripCount || 0), 0);
            const totKm = activeTrips.reduce((s, v) => s + (v.totalKm || 0), 0);
            const totFuelLiters = activeFuels.reduce((s, v) => s + (v.liters || 0), 0);
            const totFuelCost = activeFuels.reduce((s, v) => s + (v.fuelCost || 0), 0);
            const totBusBookings = busBookings.total || 0;
            const totMaintServices = completedMaint.totalCount || 0;
            const totMaintCost = completedMaint.totalCost || 0;
            const sisaOmset = busOmset.sisaOmset || 0;
            const totViolations = violations.totalViolations || 0;

            doc.autoTable({
                startY: 36,
                head: [['Total Armada Aktif', 'Total Perjalanan', 'Total Pengeluaran BBM', 'Bookingan Bus', 'Pemeliharaan Selesai', 'Sisa Omset Bus', 'Kasus Pelanggaran']],
                body: [[
                    `${totActiveUnits} Unit`,
                    `${totTrips} Trip (${Math.round(totKm).toLocaleString('id-ID')} KM)`,
                    `Rp ${Math.round(totFuelCost).toLocaleString('id-ID')}`,
                    `${totBusBookings} Agenda`,
                    `${totMaintServices} Servis (Rp ${Math.round(totMaintCost).toLocaleString('id-ID')})`,
                    `Rp ${Math.round(sisaOmset).toLocaleString('id-ID')}`,
                    `${totViolations} Kasus\n(${violations.discrepancyCount || 0} Diskrepansi, ${violations.sanctionedCount || 0} Sanksi)`
                ]],
                theme: 'grid',
                headStyles: { fillColor: [79, 70, 229], fontSize: 7.5, fontStyle: 'bold', halign: 'center' },
                bodyStyles: { fontSize: 8, fontStyle: 'bold', halign: 'center', textColor: [30, 41, 59] },
                margin: { left: 14, right: 14 }
            });

            // LAPORAN 1: Jumlah Perjalanan Masing-Masing Kendaraan (Aktif Saja)
            let currY = doc.lastAutoTable.finalY + 8;
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text('1. JUMLAH PERJALANAN MASING-MASING KENDARAAN (KHUSUS ARMADA AKTIF)', 14, currY);

            const tripRows = activeTrips.map((v, i) => [
                i + 1,
                v.name || '-',
                v.plate || '-',
                v.type || 'KENDARAAN',
                `${v.tripCount || 0} Perjalanan`,
                `${Math.round(v.totalKm || 0).toLocaleString('id-ID')} KM`,
                `${(v.utilization || 0).toFixed(0)}%`,
                'AKTIF'
            ]);

            doc.autoTable({
                startY: currY + 3,
                head: [['#', 'Nama Kendaraan', 'Plat Nomor', 'Tipe', 'Jumlah Perjalanan', 'Total Jarak Tempuh', 'Tingkat Utilisasi', 'Status Armada']],
                body: tripRows.length > 0 ? tripRows : [['-', 'Tidak ada kendaraan aktif dalam periode ini', '-', '-', '-', '-', '-', '-']],
                foot: tripRows.length > 0 ? [[
                    '', 'TOTAL PERJALANAN ARMADA AKTIF', '', '',
                    `${totTrips} Perjalanan`,
                    `${Math.round(totKm).toLocaleString('id-ID')} KM`,
                    '-', 'AKTIF'
                ]] : undefined,
                theme: 'striped',
                headStyles: { fillColor: [79, 70, 229], fontSize: 7.5, fontStyle: 'bold' },
                footStyles: { fillColor: [238, 242, 255], textColor: [49, 46, 129], fontSize: 7.5, fontStyle: 'bold' },
                bodyStyles: { fontSize: 7 },
                margin: { left: 14, right: 14 }
            });

            // ==============================================================
            // PAGE 2: LAPORAN 2 (BBM KENDARAAN AKTIF SAJA - MURNI TANPA EFISIENSI)
            // ==============================================================
            doc.addPage('landscape', 'a4');

            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(79, 70, 229);
            doc.text('YAYASAN DAR EL IMAN  |  BIDANG SARANA', 14, 14);

            doc.setFontSize(8);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(100, 116, 139);
            doc.text(`Periode: ${periodLabel || 'Semua Periode'}`, pageW - 14, 14, { align: 'right' });

            doc.setDrawColor(226, 232, 240);
            doc.line(14, 17, pageW - 14, 17);

            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text('2. REALISASI BIAYA BBM YANG DIKELUARKAN MASING-MASING KENDARAAN AKTIF SAJA', 14, 23);

            const fuelRows = activeFuels.map((v, i) => [
                i + 1,
                v.name || '-',
                v.plate || '-',
                v.type || 'KENDARAAN',
                `Rp ${Math.round(v.fuelCost || 0).toLocaleString('id-ID')}`,
                v.fuelCost > 0 ? 'Tercatat di Logbook/Struk' : 'Nihil Pengisian'
            ]);

            doc.autoTable({
                startY: 26,
                head: [['#', 'Nama Kendaraan', 'Plat Nomor', 'Tipe Kendaraan', 'Total Biaya BBM (Rp)', 'Keterangan Logbook']],
                body: fuelRows.length > 0 ? fuelRows : [['-', 'Tidak ada transaksi BBM kendaraan aktif dalam periode ini', '-', '-', '-', '-']],
                foot: fuelRows.length > 0 ? [[
                    '', 'TOTAL PENGELUARAN BBM ARMADA AKTIF', '', '',
                    `Rp ${Math.round(totFuelCost).toLocaleString('id-ID')}`,
                    `${activeFuels.filter(v => v.fuelCost > 0).length} dari ${activeFuels.length} Unit Mengisi BBM`
                ]] : undefined,
                theme: 'striped',
                headStyles: { fillColor: [2, 132, 199], fontSize: 7.5, fontStyle: 'bold' },
                footStyles: { fillColor: [240, 249, 255], textColor: [7, 89, 133], fontSize: 7.5, fontStyle: 'bold' },
                bodyStyles: { fontSize: 7 },
                margin: { left: 14, right: 14 }
            });

            // LAPORAN 3: JUMLAH BOOKINGAN BUS
            currY = doc.lastAutoTable.finalY + 8;
            if (currY > pageH - 65) {
                doc.addPage('landscape', 'a4');
                currY = 20;
            }

            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text(`3. REKAPITULASI AGENDA BOOKINGAN BUS OPERASIONAL (Total: ${busBookings.total || 0} Booking)`, 14, currY);

            const busRows = (busBookings.bookings || []).slice(0, 15).map((b, i) => [
                i + 1,
                `${new Date(b.startDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} - ${new Date(b.endDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}`,
                `${b.vehicle?.name || '-'} (${b.vehicle?.plateNumber || '-'})`,
                `${b.requesterName || b.user?.name || '-'} (${b.unit || b.user?.unit?.name || '-'})`,
                b.destination || '-',
                b.driver?.name || 'Belum Ditugaskan',
                `${b.passengerCount || 0} Orang`,
                b.status
            ]);

            doc.autoTable({
                startY: currY + 3,
                head: [['#', 'Jadwal Keberangkatan', 'Armada Bus', 'Pemesan & Unit Kerja', 'Tujuan', 'Pengemudi', 'Penumpang', 'Status']],
                body: busRows.length > 0 ? busRows : [['-', 'Tidak ada agenda bookingan bus pada periode ini', '-', '-', '-', '-', '-', '-']],
                theme: 'striped',
                headStyles: { fillColor: [147, 51, 234], fontSize: 7.5, fontStyle: 'bold' },
                bodyStyles: { fontSize: 7 },
                margin: { left: 14, right: 14 }
            });

            // ==============================================================
            // PAGE 3: LAPORAN 4 (PEMELIHARAAN TERLAKSANA) & LAPORAN 5 (SISA OMSET BUS)
            // ==============================================================
            doc.addPage('landscape', 'a4');

            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(79, 70, 229);
            doc.text('YAYASAN DAR EL IMAN  |  BIDANG SARANA', 14, 14);

            doc.setFontSize(8);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(100, 116, 139);
            doc.text(`Periode: ${periodLabel || 'Semua Periode'}`, pageW - 14, 14, { align: 'right' });

            doc.setDrawColor(226, 232, 240);
            doc.line(14, 17, pageW - 14, 17);

            // LAPORAN 4: Pemeliharaan yang Terlaksana
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text(`4. REKAPITULASI PEMELIHARAAN YANG TELAH TERLAKSANA (Total: ${completedMaint.totalCount || 0} Kegiatan, Rp ${Math.round(completedMaint.totalCost || 0).toLocaleString('id-ID')})`, 14, 23);

            const maintRows = (completedMaint.services || []).slice(0, 15).map((m, i) => [
                i + 1,
                m.serviceDate ? new Date(m.serviceDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-',
                `${m.vehicle?.name || '-'} (${m.vehicle?.plateNumber || '-'})`,
                m.serviceType || 'PERBAIKAN',
                m.workshopName || '-',
                (m.description || '-').substring(0, 40),
                `Rp ${Math.round(m.cost || 0).toLocaleString('id-ID')}`
            ]);

            doc.autoTable({
                startY: 26,
                head: [['#', 'Tgl Selesai', 'Kendaraan', 'Jenis Perawatan', 'Bengkel Rekanan', 'Deskripsi Pekerjaan', 'Biaya Riil']],
                body: maintRows.length > 0 ? maintRows : [['-', '-', 'Tidak ada pemeliharaan yang telah selesai dalam periode ini', '-', '-', '-', '-']],
                foot: maintRows.length > 0 ? [[
                    '', 'TOTAL BIAYA PEMELIHARAAN TERLAKSANA', '', '', '', '',
                    `Rp ${Math.round(totMaintCost).toLocaleString('id-ID')}`
                ]] : undefined,
                theme: 'striped',
                headStyles: { fillColor: [245, 158, 11], fontSize: 7.5, fontStyle: 'bold' },
                footStyles: { fillColor: [254, 243, 199], textColor: [146, 64, 14], fontSize: 7.5, fontStyle: 'bold' },
                bodyStyles: { fontSize: 7 },
                margin: { left: 14, right: 14 }
            });

            // LAPORAN 5: Sisa Omset Bus (Pemasukan vs Pengeluaran)
            currY = doc.lastAutoTable.finalY + 8;
            if (currY > pageH - 70) {
                doc.addPage('landscape', 'a4');
                currY = 20;
            }

            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text('5. NERACA FINANSIAL OPERASIONAL & SISA OMSET BUS (NET SURPLUS)', 14, currY);

            const busFinancialRows = [
                ['Total Pendapatan Sewa/Tagihan Bus', `Rp ${Math.round(busOmset.bookingRevenue || 0).toLocaleString('id-ID')}`, 'Realisasi tagihan booking bus yang disetujui/selesai'],
                ['Total Pendapatan Lain-lain Bus', `Rp ${Math.round(busOmset.otherIncome || 0).toLocaleString('id-ID')}`, 'Pemasukan non-sewa dan sponsorship operasional bus'],
                ['TOTAL OMSET / PENDAPATAN BUS', `Rp ${Math.round(busOmset.totalRevenue || 0).toLocaleString('id-ID')}`, 'Akumulasi seluruh pemasukan operasional bus'],
                ['Beban Bahan Bakar (BBM) Bus', `Rp ${Math.round(busOmset.fuelExpenses || 0).toLocaleString('id-ID')}`, 'Total pengeluaran bensin & solar armada bus'],
                ['Beban Pemeliharaan & Servis Bus', `Rp ${Math.round(busOmset.maintenanceExpenses || 0).toLocaleString('id-ID')}`, 'Total servis, ganti oli, suku cadang armada bus'],
                ['Beban Operasional Tak Terduga Bus', `Rp ${Math.round(busOmset.unexpectedExpenses || 0).toLocaleString('id-ID')}`, 'Biaya tol, parkir, konsumsi, dan insidental bus'],
                ['TOTAL PENGELUARAN OPERASIONAL BUS', `Rp ${Math.round(busOmset.totalExpenses || 0).toLocaleString('id-ID')}`, 'Akumulasi beban operasional armada bus'],
                ['SISA OMSET BERSIH (NET SURPLUS)', `Rp ${Math.round(busOmset.sisaOmset || 0).toLocaleString('id-ID')}`, `Margin Laba: ${busOmset.marginPercent || 0}%`]
            ];

            doc.autoTable({
                startY: currY + 3,
                head: [['Komponen Neraca Keuangan Bus', 'Realisasi Finansial (Rp)', 'Keterangan']],
                body: busFinancialRows,
                theme: 'grid',
                headStyles: { fillColor: [16, 185, 129], fontSize: 7.5, fontStyle: 'bold' },
                bodyStyles: { fontSize: 7 },
                columnStyles: { 0: { cellWidth: 70, fontStyle: 'bold' }, 1: { fontStyle: 'bold' } },
                margin: { left: 14, right: 14 }
            });

            // ==============================================================
            // PAGE 4: LAPORAN 6 (TOP DRIVER) & LAPORAN 7 (PELANGGARAN WAKTU)
            // ==============================================================
            doc.addPage('landscape', 'a4');

            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(79, 70, 229);
            doc.text('YAYASAN DAR EL IMAN  |  BIDANG SARANA', 14, 14);

            doc.setFontSize(8);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(100, 116, 139);
            doc.text(`Periode: ${periodLabel || 'Semua Periode'}`, pageW - 14, 14, { align: 'right' });

            doc.setDrawColor(226, 232, 240);
            doc.line(14, 17, pageW - 14, 17);

            // LAPORAN 6: Top Driver
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text('6. LEADERBOARD TOP DRIVER (PRODUKTIVITAS & DISIPLIN)', 14, 23);

            const driverRows = topDrivers.map((d, i) => [
                i + 1,
                d.name || '-',
                d.phone || '-',
                `${d.totalTrips || 0} Perjalanan (${d.vehicleTrips || 0} Mobil, ${d.busTrips || 0} Bus)`,
                `${Math.round(d.totalKm || 0).toLocaleString('id-ID')} KM`,
                `${d.violationCount || 0} Peringatan`,
                i === 0 ? '🏆 Driver Teladan' : d.violationCount > 0 ? '⚠️ Dalam Pantauan' : '✅ Disiplin'
            ]);

            doc.autoTable({
                startY: 26,
                head: [['Rank', 'Nama Pengemudi', 'Nomor Kontak', 'Total Perjalanan', 'Jarak Tempuh', 'Catatan Pelanggaran', 'Status Kinerja']],
                body: driverRows.length > 0 ? driverRows : [['-', 'Tidak ada penugasan supir dalam periode ini', '-', '-', '-', '-', '-']],
                theme: 'striped',
                headStyles: { fillColor: [217, 119, 6], fontSize: 7.5, fontStyle: 'bold' },
                bodyStyles: { fontSize: 7 },
                margin: { left: 14, right: 14 }
            });

            // LAPORAN 7: AUDIT PELANGGARAN (1. DISKREPANSI & 2. AKUN DISANKSI)
            currY = doc.lastAutoTable.finalY + 8;
            if (currY > pageH - 95) {
                doc.addPage('landscape', 'a4');
                currY = 20;
            }

            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text(`7. AUDIT PELANGGARAN: DISKREPANSI ODOMETER & AKUN KENA SANKSI (Total: ${violations.totalViolations || 0} Kasus)`, 14, currY);

            // Sub-tabel 7.1: Kejadian Diskrepansi Odometer
            doc.setFontSize(8.5);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(225, 29, 72);
            doc.text(`7.1 Kejadian Diskrepansi Odometer Kendaraan (${violations.discrepancyCount || 0} Insiden, Selisih +${(violations.totalDiscrepancyKm || 0).toLocaleString('id-ID')} KM Luar Sistem)`, 14, currY + 5);

            const discRows = (violations.discrepancies || []).slice(0, 25).map((d, i) => [
                i + 1,
                d.date ? new Date(d.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-',
                `${d.vehicleName || '-'} (${d.vehiclePlate || '-'})`,
                `${d.userName || '-'} (${d.userUnit || '-'})`,
                `${d.prevEndKm != null ? d.prevEndKm.toLocaleString('id-ID') + ' KM' : '-'}`,
                `${d.currentStartKm != null ? d.currentStartKm.toLocaleString('id-ID') + ' KM' : '-'}`,
                `+${d.discrepancyKm != null ? d.discrepancyKm.toLocaleString('id-ID') : 0} KM`,
                d.destination || d.notes || '-'
            ]);

            doc.autoTable({
                startY: currY + 8,
                head: [['#', 'Waktu Terdeteksi', 'Armada & Plat', 'Peminjam / Pelapor', 'KM Terakhir Sistem', 'KM Awal Input', 'Selisih (+KM)', 'Keterangan / Tujuan']],
                body: discRows.length > 0 ? discRows : [['-', 'Nihil kejadian diskrepansi odometer kendaraan pada periode ini', '-', '-', '-', '-', '-', '-']],
                theme: 'striped',
                headStyles: { fillColor: [225, 29, 72], fontSize: 7, fontStyle: 'bold' },
                bodyStyles: { fontSize: 6.5 },
                margin: { left: 14, right: 14 }
            });

            // Sub-tabel 7.2: Akun yang Kena Sanksi
            currY = doc.lastAutoTable.finalY + 7;
            if (currY > pageH - 55) {
                doc.addPage('landscape', 'a4');
                currY = 20;
            }

            doc.setFontSize(8.5);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(15, 23, 42);
            doc.text(`7.2 Daftar Akun Pengguna yang Kena Sanksi Peminjaman (${violations.sanctionedCount || 0} Pengguna Terkena Sanksi)`, 14, currY);

            const sanctionedRows = (violations.sanctionedUsers || []).map((u, i) => [
                i + 1,
                u.name || '-',
                `${u.unitName || u.unit?.name || 'Umum'} - ${u.position || 'Staff'}`,
                u.phone || '-',
                u.statusLabel || (u.sanctionProposedLift ? 'Menunggu Review' : 'Akun Dibekukan'),
                u.sanctionLiftReason || 'Pelanggaran SOP Peminjaman Armada'
            ]);

            doc.autoTable({
                startY: currY + 4,
                head: [['#', 'Nama Pengguna', 'Unit Kerja & Jabatan', 'No. Kontak', 'Status Akun', 'Alasan / Uraian Sanksi']],
                body: sanctionedRows.length > 0 ? sanctionedRows : [['-', 'Tidak ada akun pengguna yang sedang dikenakan sanksi peminjaman', '-', '-', '-', '-']],
                theme: 'striped',
                headStyles: { fillColor: [30, 41, 59], fontSize: 7, fontStyle: 'bold' },
                bodyStyles: { fontSize: 6.5 },
                margin: { left: 14, right: 14 }
            });

            // Page Numbers (Tanpa Blok TTD Sesuai Ketentuan)
            const totalPages = doc.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                doc.setFontSize(7.5);
                doc.setFont(undefined, 'normal');
                doc.setTextColor(148, 163, 184);
                doc.text(
                    `Halaman ${i} dari ${totalPages}  |  Laporan Resmi 7 Indikator Operasional Armada  |  Bidang Sarpras Yayasan Dar El-Iman`,
                    pageW / 2,
                    pageH - 7,
                    { align: 'center' }
                );
            }

            const fileCleanPeriod = (periodLabel || 'Semua_Periode').replace(/[^a-zA-Z0-9]/g, '_');
            doc.save(`Laporan_7_Indikator_Armada_${fileCleanPeriod}_${now.toISOString().slice(0, 10)}.pdf`);
        } catch (err) {
            console.error('PDF Export 7 Reports Error:', err);
            alert('Gagal mencetak PDF 7 Laporan: ' + err.message);
        } finally {
            setExportingPdf(false);
        }
    };

    // ==============================================================
    // EKSPOR GABUNGAN 7 INDIKATOR KE FORMAT DOC (MICROSOFT WORD)
    // ==============================================================
    const handleExportSevenReportsDOC = () => {
        try {
            setExportingDoc(true);
            const now = new Date();
            const printDateStr = now.toLocaleDateString('id-ID', {
                day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            const totActiveUnits = activeTrips.length;
            const totTrips = activeTrips.reduce((s, v) => s + (v.tripCount || 0), 0);
            const totKm = activeTrips.reduce((s, v) => s + (v.totalKm || 0), 0);
            const totFuelCost = activeFuels.reduce((s, v) => s + (v.fuelCost || 0), 0);
            const totBusBookings = busBookings.total || 0;
            const totMaintServices = completedMaint.totalCount || 0;
            const totMaintCost = completedMaint.totalCost || 0;
            const sisaOmset = busOmset.sisaOmset || 0;
            const totViolations = violations.totalViolations || 0;

            const renderKop = (titleText) => `
                <div style="text-align: center; margin-bottom: 12px; border-bottom: 2px solid #cbd5e1; padding-bottom: 8px;">
                    <h2 style="margin: 0; font-size: 14pt; color: #1e293b; font-family: Calibri, Arial, sans-serif; text-transform: uppercase;">YAYASAN DAR EL IMAN</h2>
                    <h3 style="margin: 2px 0; font-size: 11pt; color: #4338ca; font-family: Calibri, Arial, sans-serif; text-transform: uppercase;">BIDANG SARANA</h3>
                    <h4 style="margin: 4px 0 2px 0; font-size: 11pt; color: #0f172a; font-family: Calibri, Arial, sans-serif;">${titleText}</h4>
                    <p style="margin: 2px 0 0 0; font-size: 8.5pt; color: #64748b; font-family: Calibri, Arial, sans-serif;">
                        Periode Data: <b>${periodLabel || 'Semua Periode'}</b> &nbsp;|&nbsp; Tanggal Cetak: <b>${printDateStr}</b> &nbsp;|&nbsp; Sistem: <b>Manajemen Aset & Armada</b>
                    </p>
                </div>
            `;

            // 1. Ringkasan Eksekutif
            const summaryTableHtml = `
                <table class="report-table" style="margin-bottom: 14px;">
                    <thead>
                        <tr style="background-color: #4338ca; color: #ffffff;">
                            <th>Total Armada Aktif</th>
                            <th>Total Perjalanan</th>
                            <th>Total Biaya BBM</th>
                            <th>Bookingan Bus</th>
                            <th>Pemeliharaan Selesai</th>
                            <th>Sisa Omset Bus</th>
                            <th>Kasus Pelanggaran</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="font-weight: bold; text-align: center;">
                            <td>${totActiveUnits} Unit</td>
                            <td>${totTrips} Trip (${Math.round(totKm).toLocaleString('id-ID')} KM)</td>
                            <td>Rp ${Math.round(totFuelCost).toLocaleString('id-ID')}</td>
                            <td>${totBusBookings} Agenda</td>
                            <td>${totMaintServices} Servis (Rp ${Math.round(totMaintCost).toLocaleString('id-ID')})</td>
                            <td>Rp ${Math.round(sisaOmset).toLocaleString('id-ID')}</td>
                            <td>${totViolations} Kasus (${violations.discrepancyCount || 0} Diskrepansi, ${violations.sanctionedCount || 0} Sanksi)</td>
                        </tr>
                    </tbody>
                </table>
            `;

            // Indikator 1
            const tripRowsHtml = activeTrips.map((v, i) => `
                <tr>
                    <td class="text-center">${i + 1}</td>
                    <td class="font-bold">${v.name || '-'}</td>
                    <td class="text-center">${v.plate || '-'}</td>
                    <td class="text-center">${v.type || 'KENDARAAN'}</td>
                    <td class="text-center">${v.tripCount || 0} Trip</td>
                    <td class="text-right">${Math.round(v.totalKm || 0).toLocaleString('id-ID')} KM</td>
                    <td class="text-center">${(v.utilization || 0).toFixed(0)}%</td>
                    <td class="text-center font-bold" style="color: #059669;">AKTIF</td>
                </tr>
            `).join('');

            // Indikator 2
            const fuelRowsHtml = activeFuels.map((v, i) => `
                <tr>
                    <td class="text-center">${i + 1}</td>
                    <td class="font-bold">${v.name || '-'}</td>
                    <td class="text-center">${v.plate || '-'}</td>
                    <td class="text-center">${v.type || 'KENDARAAN'}</td>
                    <td class="text-right font-bold">Rp ${Math.round(v.fuelCost || 0).toLocaleString('id-ID')}</td>
                    <td>${v.fuelCost > 0 ? 'Tercatat di Logbook/Struk' : 'Nihil Pengisian'}</td>
                </tr>
            `).join('');

            // Indikator 3
            const busRowsHtml = (busBookings.bookings || []).map((b, i) => `
                <tr>
                    <td class="text-center">${i + 1}</td>
                    <td class="text-center">${new Date(b.startDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} - ${new Date(b.endDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</td>
                    <td class="font-bold">${b.vehicle?.name || '-'} (${b.vehicle?.plateNumber || '-'})</td>
                    <td>${b.requesterName || b.user?.name || '-'} (${b.unit || b.user?.unit?.name || '-'})</td>
                    <td>${b.destination || '-'}</td>
                    <td>${b.driver?.name || 'Belum Ditugaskan'}</td>
                    <td class="text-center">${b.passengerCount || 0} Org</td>
                    <td class="text-center font-bold">${b.status}</td>
                </tr>
            `).join('');

            // Indikator 4
            const maintRowsHtml = (completedMaint.services || []).map((m, i) => `
                <tr>
                    <td class="text-center">${i + 1}</td>
                    <td class="text-center">${m.serviceDate ? new Date(m.serviceDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</td>
                    <td class="font-bold">${m.vehicle?.name || '-'} (${m.vehicle?.plateNumber || '-'})</td>
                    <td class="text-center">${m.serviceType || 'PERBAIKAN'}</td>
                    <td>${m.workshopName || '-'}</td>
                    <td>${(m.description || '-')}</td>
                    <td class="text-right font-bold">Rp ${Math.round(m.cost || 0).toLocaleString('id-ID')}</td>
                </tr>
            `).join('');

            // Indikator 5
            const busFinancialRowsHtml = [
                ['Total Pendapatan Sewa/Tagihan Bus', `Rp ${Math.round(busOmset.bookingRevenue || 0).toLocaleString('id-ID')}`, 'Realisasi tagihan booking bus yang disetujui/selesai'],
                ['Total Pendapatan Lain-lain Bus', `Rp ${Math.round(busOmset.otherIncome || 0).toLocaleString('id-ID')}`, 'Pemasukan non-sewa dan sponsorship operasional bus'],
                ['TOTAL OMSET / PENDAPATAN BUS', `Rp ${Math.round(busOmset.totalRevenue || 0).toLocaleString('id-ID')}`, 'Akumulasi seluruh pemasukan operasional bus'],
                ['Beban Bahan Bakar (BBM) Bus', `Rp ${Math.round(busOmset.fuelExpenses || 0).toLocaleString('id-ID')}`, 'Total pengeluaran bensin & solar armada bus'],
                ['Beban Pemeliharaan & Servis Bus', `Rp ${Math.round(busOmset.maintenanceExpenses || 0).toLocaleString('id-ID')}`, 'Total servis, ganti oli, suku cadang armada bus'],
                ['Beban Operasional Tak Terduga Bus', `Rp ${Math.round(busOmset.unexpectedExpenses || 0).toLocaleString('id-ID')}`, 'Biaya tol, parkir, konsumsi, dan insidental bus'],
                ['TOTAL PENGELUARAN OPERASIONAL BUS', `Rp ${Math.round(busOmset.totalExpenses || 0).toLocaleString('id-ID')}`, 'Akumulasi beban operasional armada bus'],
                ['SISA OMSET BERSIH (NET SURPLUS)', `Rp ${Math.round(busOmset.sisaOmset || 0).toLocaleString('id-ID')}`, `Margin Laba: ${busOmset.marginPercent || 0}%`]
            ].map(([k, v, desc]) => `
                <tr>
                    <td class="font-bold">${k}</td>
                    <td class="text-right font-bold">${v}</td>
                    <td>${desc}</td>
                </tr>
            `).join('');

            // Indikator 6
            const driverRowsHtml = topDrivers.map((d, i) => `
                <tr>
                    <td class="text-center font-bold">${i + 1}</td>
                    <td class="font-bold">${d.name || '-'}</td>
                    <td>${d.phone || '-'}</td>
                    <td class="text-center">${d.totalTrips || 0} Trip</td>
                    <td class="text-right">${Math.round(d.totalKm || 0).toLocaleString('id-ID')} KM</td>
                    <td class="text-center">${d.violationCount || 0} Peringatan</td>
                    <td class="text-center font-bold">${i === 0 ? 'Driver Teladan' : d.violationCount > 0 ? 'Dalam Pantauan' : 'Disiplin'}</td>
                </tr>
            `).join('');

            // Indikator 7.1 Diskrepansi
            const discRowsHtml = (violations.discrepancies || []).map((d, i) => `
                <tr>
                    <td class="text-center font-bold">${i + 1}</td>
                    <td class="text-center">${d.date ? new Date(d.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td class="font-bold">${d.vehicleName || '-'} (${d.vehiclePlate || '-'})</td>
                    <td>${d.userName || '-'} (${d.userUnit || '-'})</td>
                    <td class="text-right">${d.prevEndKm != null ? d.prevEndKm.toLocaleString('id-ID') : '-'} KM</td>
                    <td class="text-right font-bold">${d.currentStartKm != null ? d.currentStartKm.toLocaleString('id-ID') : '-'} KM</td>
                    <td class="text-center font-bold" style="color: #dc2626;">+${d.discrepancyKm != null ? d.discrepancyKm.toLocaleString('id-ID') : 0} KM</td>
                    <td>${d.destination || d.notes || '-'}</td>
                </tr>
            `).join('');

            // Indikator 7.2 Akun Sanksi
            const sanctionedRowsHtml = (violations.sanctionedUsers || []).map((u, i) => `
                <tr>
                    <td class="text-center font-bold">${i + 1}</td>
                    <td class="font-bold">${u.name || '-'}</td>
                    <td>${u.unitName || u.unit?.name || 'Umum'} - ${u.position || 'Staff'}</td>
                    <td class="text-center">${u.phone || '-'}</td>
                    <td class="text-center font-bold" style="color: ${u.sanctionProposedLift ? '#d97706' : '#dc2626'};">${u.statusLabel || (u.sanctionProposedLift ? 'Menunggu Review' : 'Akun Dibekukan')}</td>
                    <td>${u.sanctionLiftReason || 'Pelanggaran SOP Peminjaman Armada'}</td>
                </tr>
            `).join('');

            const docHtml = `
                <html xmlns:o='urn:schemas-microsoft-com:office:office'
                      xmlns:w='urn:schemas-microsoft-com:office:word'
                      xmlns='http://www.w3.org/TR/REC-html40'>
                <head>
                    <meta charset="utf-8">
                    <title>Laporan 7 Indikator Utama Operasional Armada</title>
                    <!--[if gte mso 9]>
                    <xml>
                        <w:WordDocument>
                            <w:View>Print</w:View>
                            <w:Zoom>100</w:Zoom>
                            <w:DoNotOptimizeForBrowser/>
                        </w:WordDocument>
                    </xml>
                    <![endif]-->
                    <style>
                        @page Section1 {
                            size: 841.9pt 595.3pt;
                            mso-page-orientation: landscape;
                            margin: 1.5cm 1.5cm 1.5cm 1.5cm;
                        }
                        div.Section1 {
                            page: Section1;
                            font-family: 'Calibri', 'Arial', sans-serif;
                            font-size: 9pt;
                            color: #1e293b;
                        }
                        .page-break {
                            page-break-before: always;
                            mso-special-character: line-break;
                        }
                        .report-table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-bottom: 14px;
                            font-size: 8pt;
                            font-family: 'Calibri', 'Arial', sans-serif;
                        }
                        .report-table th {
                            border: 1px solid #cbd5e1;
                            padding: 5px 7px;
                            font-size: 8pt;
                            font-weight: bold;
                            text-align: center;
                        }
                        .report-table td {
                            border: 1px solid #cbd5e1;
                            padding: 4px 7px;
                            color: #334155;
                            font-size: 7.5pt;
                        }
                        .report-table tr:nth-child(even) td {
                            background-color: #f8fafc;
                        }
                        .report-table tfoot td {
                            background-color: #f1f5f9;
                            font-weight: bold;
                        }
                        .text-center { text-align: center; }
                        .text-right { text-align: right; }
                        .font-bold { font-weight: bold; }
                    </style>
                </head>
                <body>
                    <div class="Section1">
                        ${renderKop('LAPORAN KHUSUS: 7 INDIKATOR UTAMA OPERASIONAL ARMADA')}
                        ${summaryTableHtml}

                        <h4 style="margin: 12px 0 6px 0; font-size: 10pt; color: #1e293b;">1. JUMLAH PERJALANAN MASING-MASING KENDARAAN (ARMADA AKTIF)</h4>
                        <table class="report-table">
                            <thead>
                                <tr style="background-color: #4338ca; color: #ffffff;">
                                    <th style="width: 30px;">#</th>
                                    <th>Nama Kendaraan</th>
                                    <th>Plat Nomor</th>
                                    <th>Tipe</th>
                                    <th>Jumlah Perjalanan</th>
                                    <th>Total Jarak Tempuh</th>
                                    <th>Tingkat Utilisasi</th>
                                    <th>Status Armada</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tripRowsHtml || '<tr><td colspan="8" class="text-center">Tidak ada kendaraan aktif dalam periode ini</td></tr>'}
                            </tbody>
                        </table>

                        <h4 style="margin: 16px 0 6px 0; font-size: 10pt; color: #1e293b;">2. REALISASI BIAYA BBM MASING-MASING KENDARAAN AKTIF SAJA</h4>
                        <table class="report-table">
                            <thead>
                                <tr style="background-color: #0284c7; color: #ffffff;">
                                    <th style="width: 30px;">#</th>
                                    <th>Nama Kendaraan</th>
                                    <th>Plat Nomor</th>
                                    <th>Tipe Kendaraan</th>
                                    <th>Total Biaya BBM (Rp)</th>
                                    <th>Keterangan Logbook</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${fuelRowsHtml || '<tr><td colspan="6" class="text-center">Tidak ada transaksi BBM kendaraan aktif dalam periode ini</td></tr>'}
                            </tbody>
                        </table>

                        <div class="page-break"></div>
                        ${renderKop('LAPORAN KHUSUS: 7 INDIKATOR UTAMA OPERASIONAL ARMADA (LANJUTAN)')}

                        <h4 style="margin: 12px 0 6px 0; font-size: 10pt; color: #1e293b;">3. REKAPITULASI AGENDA BOOKINGAN BUS OPERASIONAL (Total: ${busBookings.total || 0} Booking)</h4>
                        <table class="report-table">
                            <thead>
                                <tr style="background-color: #9333ea; color: #ffffff;">
                                    <th style="width: 30px;">#</th>
                                    <th>Jadwal Keberangkatan</th>
                                    <th>Armada Bus</th>
                                    <th>Pemesan & Unit Kerja</th>
                                    <th>Tujuan</th>
                                    <th>Pengemudi</th>
                                    <th>Penumpang</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${busRowsHtml || '<tr><td colspan="8" class="text-center">Tidak ada agenda bookingan bus pada periode ini</td></tr>'}
                            </tbody>
                        </table>

                        <h4 style="margin: 16px 0 6px 0; font-size: 10pt; color: #1e293b;">4. REKAPITULASI PEMELIHARAAN YANG TELAH TERLAKSANA (Total: ${completedMaint.totalCount || 0} Kegiatan)</h4>
                        <table class="report-table">
                            <thead>
                                <tr style="background-color: #f59e0b; color: #ffffff;">
                                    <th style="width: 30px;">#</th>
                                    <th>Tgl Selesai</th>
                                    <th>Kendaraan</th>
                                    <th>Jenis Perawatan</th>
                                    <th>Bengkel Rekanan</th>
                                    <th>Deskripsi Pekerjaan</th>
                                    <th>Biaya Riil</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${maintRowsHtml || '<tr><td colspan="7" class="text-center">Tidak ada pemeliharaan yang telah selesai dalam periode ini</td></tr>'}
                            </tbody>
                        </table>

                        <div class="page-break"></div>
                        ${renderKop('LAPORAN KHUSUS: 7 INDIKATOR UTAMA OPERASIONAL ARMADA (LANJUTAN)')}

                        <h4 style="margin: 12px 0 6px 0; font-size: 10pt; color: #1e293b;">5. NERACA FINANSIAL OPERASIONAL & SISA OMSET BUS (NET SURPLUS)</h4>
                        <table class="report-table">
                            <thead>
                                <tr style="background-color: #10b981; color: #ffffff;">
                                    <th>Komponen Neraca Keuangan Bus</th>
                                    <th>Realisasi Finansial (Rp)</th>
                                    <th>Keterangan</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${busFinancialRowsHtml}
                            </tbody>
                        </table>

                        <h4 style="margin: 16px 0 6px 0; font-size: 10pt; color: #1e293b;">6. LEADERBOARD TOP DRIVER (PRODUKTIVITAS & DISIPLIN)</h4>
                        <table class="report-table">
                            <thead>
                                <tr style="background-color: #d97706; color: #ffffff;">
                                    <th style="width: 30px;">#</th>
                                    <th>Nama Pengemudi</th>
                                    <th>Nomor Kontak</th>
                                    <th>Total Perjalanan</th>
                                    <th>Jarak Tempuh</th>
                                    <th>Catatan Pelanggaran</th>
                                    <th>Status Kinerja</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${driverRowsHtml || '<tr><td colspan="7" class="text-center">Tidak ada penugasan supir dalam periode ini</td></tr>'}
                            </tbody>
                        </table>

                        <h4 style="margin: 16px 0 4px 0; font-size: 10pt; color: #1e293b;">7. AUDIT PELANGGARAN: DISKREPANSI ODOMETER & AKUN KENA SANKSI (Total: ${violations.totalViolations || 0} Kasus)</h4>
                        
                        <h5 style="margin: 10px 0 4px 0; font-size: 8.5pt; color: #dc2626;">7.1 Riwayat Kejadian Diskrepansi Odometer Kendaraan (${violations.discrepancyCount || 0} Insiden, Selisih +${(violations.totalDiscrepancyKm || 0).toLocaleString('id-ID')} KM Luar Sistem)</h5>
                        <table class="report-table">
                            <thead>
                                <tr style="background-color: #dc2626; color: #ffffff;">
                                    <th style="width: 25px;">#</th>
                                    <th>Waktu Terdeteksi</th>
                                    <th>Armada & Plat</th>
                                    <th>Peminjam / Pelapor</th>
                                    <th>KM Terakhir Sistem</th>
                                    <th>KM Awal Input</th>
                                    <th>Selisih (+KM)</th>
                                    <th>Catatan / Tujuan</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${discRowsHtml || '<tr><td colspan="8" class="text-center">Nihil kejadian diskrepansi odometer kendaraan pada periode ini</td></tr>'}
                            </tbody>
                        </table>

                        <h5 style="margin: 12px 0 4px 0; font-size: 8.5pt; color: #1e293b;">7.2 Daftar Akun Pengguna yang Kena Sanksi Peminjaman (${violations.sanctionedCount || 0} Pengguna Terkena Sanksi)</h5>
                        <table class="report-table">
                            <thead>
                                <tr style="background-color: #1e293b; color: #ffffff;">
                                    <th style="width: 25px;">#</th>
                                    <th>Nama Pengguna</th>
                                    <th>Unit Kerja & Jabatan</th>
                                    <th>No. Kontak</th>
                                    <th>Status Akun</th>
                                    <th>Alasan / Uraian Sanksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${sanctionedRowsHtml || '<tr><td colspan="6" class="text-center">Tidak ada akun pengguna yang sedang dikenakan sanksi peminjaman</td></tr>'}
                            </tbody>
                        </table>

                        <!-- FOOTER RESMI (TANPA TTD) -->
                        <div style="margin-top: 25px; padding-top: 10px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 8pt; color: #94a3b8;">
                            Dokumen Resmi Sistem Manajemen Aset & Armada Yayasan Dar El-Iman &bull; Dihasilkan Otomatis oleh Sistem
                        </div>
                    </div>
                </body>
                </html>
            `;

            const blob = new Blob(['\ufeff', docHtml], {
                type: 'application/msword;charset=utf-8'
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const fileCleanPeriod = (periodLabel || 'Semua_Periode').replace(/[^a-zA-Z0-9]/g, '_');
            a.download = `Laporan_7_Indikator_Armada_${fileCleanPeriod}_${now.toISOString().slice(0, 10)}.doc`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('DOC Export 7 Reports Error:', err);
            alert('Gagal mengekspor DOC 7 Laporan: ' + err.message);
        } finally {
            setExportingDoc(false);
        }
    };

    // Forward ref capabilities jika exportRef disediakan
    if (exportRef) {
        if (typeof exportRef === 'function') {
            exportRef({ exportPDF: handleExportSevenReportsPDF, exportDOC: handleExportSevenReportsDOC });
        } else if (exportRef.current !== undefined) {
            exportRef.current = { exportPDF: handleExportSevenReportsPDF, exportDOC: handleExportSevenReportsDOC };
        }
    }

    // Handle AI generation
    const handleGenerateAI = async () => {
        try {
            setAiLoading(true);
            setShowAiModal(true);
            const res = await api.post('/vehicles/ai/analyze', {
                period: periodLabel || 'Semua Periode',
                stats: data?.stats || {},
                vStats: data?.vStats || [],
                urgentActions: data?.urgentActions || [],
                busSummary: (busBookings.bookings || []).slice(0, 8).map(b => 
                    `- ${b.vehicle?.name}: ${new Date(b.startDate).toLocaleDateString('id-ID')} -> ${b.destination} (${b.status})`
                ).join('\n'),
                activeVehicleTripStats: activeTrips,
                activeVehicleFuelStats: activeFuels,
                busBookingStats: busBookings,
                completedMaintenanceStats: completedMaint,
                busOmsetStats: busOmset,
                topDrivers: topDrivers,
                dateViolationsStats: violations
            });
            setAiAnalysis(res.data?.analysis || 'Tidak ada analisis yang dihasilkan.');
        } catch (err) {
            console.error('AI Fleet Analysis failed:', err);
            setAiAnalysis('Gagal menghasilkan analisis AI. Pastikan server backend dan koneksi AI Gemini aktif.');
        } finally {
            setAiLoading(false);
        }
    };

    const handleCopyAi = () => {
        if (!aiAnalysis) return;
        navigator.clipboard.writeText(aiAnalysis);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Filtered lists for each tab
    const filteredTrips = useMemo(() => {
        if (!searchQuery) return activeTrips;
        const q = searchQuery.toLowerCase();
        return activeTrips.filter(v => v.name?.toLowerCase().includes(q) || v.plate?.toLowerCase().includes(q));
    }, [activeTrips, searchQuery]);

    const filteredFuels = useMemo(() => {
        if (!searchQuery) return activeFuels;
        const q = searchQuery.toLowerCase();
        return activeFuels.filter(v => v.name?.toLowerCase().includes(q) || v.plate?.toLowerCase().includes(q));
    }, [activeFuels, searchQuery]);

    const filteredBusList = useMemo(() => {
        const list = busBookings.bookings || [];
        if (!searchQuery) return list;
        const q = searchQuery.toLowerCase();
        return list.filter(b => 
            b.vehicle?.name?.toLowerCase().includes(q) ||
            b.destination?.toLowerCase().includes(q) ||
            b.requesterName?.toLowerCase().includes(q) ||
            b.user?.name?.toLowerCase().includes(q) ||
            b.driver?.name?.toLowerCase().includes(q)
        );
    }, [busBookings, searchQuery]);

    const filteredMaintList = useMemo(() => {
        const list = completedMaint.services || [];
        if (!searchQuery) return list;
        const q = searchQuery.toLowerCase();
        return list.filter(s => 
            s.vehicle?.name?.toLowerCase().includes(q) ||
            s.vehicle?.plateNumber?.toLowerCase().includes(q) ||
            s.description?.toLowerCase().includes(q) ||
            s.workshop?.toLowerCase().includes(q)
        );
    }, [completedMaint, searchQuery]);

    const filteredDrivers = useMemo(() => {
        if (!searchQuery) return topDrivers;
        const q = searchQuery.toLowerCase();
        return topDrivers.filter(d => d.name?.toLowerCase().includes(q) || d.unit?.toLowerCase().includes(q));
    }, [topDrivers, searchQuery]);

    const filteredDiscrepancies = useMemo(() => {
        const list = violations.discrepancies || [];
        if (!searchQuery) return list;
        const q = searchQuery.toLowerCase();
        return list.filter(d => 
            (d.vehicleName || '').toLowerCase().includes(q) ||
            (d.vehiclePlate || '').toLowerCase().includes(q) ||
            (d.userName || '').toLowerCase().includes(q) ||
            (d.userUnit || '').toLowerCase().includes(q) ||
            (d.destination || '').toLowerCase().includes(q) ||
            (d.notes || '').toLowerCase().includes(q)
        );
    }, [violations, searchQuery]);

    const filteredSanctionedUsers = useMemo(() => {
        const list = violations.sanctionedUsers || [];
        if (!searchQuery) return list;
        const q = searchQuery.toLowerCase();
        return list.filter(u => 
            (u.name || '').toLowerCase().includes(q) ||
            (u.unitName || '').toLowerCase().includes(q) ||
            (u.position || '').toLowerCase().includes(q) ||
            (u.phone || '').toLowerCase().includes(q) ||
            (u.sanctionLiftReason || '').toLowerCase().includes(q)
        );
    }, [violations, searchQuery]);

    const subTabs = [
        { id: 'TRIPS', label: '1. Perjalanan Armada Aktif', icon: Car, count: `${activeTrips.length} Unit`, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
        { id: 'FUEL', label: '2. BBM Armada Aktif', icon: Fuel, count: `Rp ${Math.round((activeFuels.reduce((s, v) => s + v.fuelCost, 0)) / 1000).toLocaleString('id-ID')}k`, color: 'text-sky-600 bg-sky-50 border-sky-200' },
        { id: 'BUS_BOOKINGS', label: '3. Bookingan Bus', icon: Bus, count: `${busBookings.total || 0} Booking`, color: 'text-purple-600 bg-purple-50 border-purple-200' },
        { id: 'MAINTENANCE', label: '4. Pemeliharaan Terlaksana', icon: Wrench, count: `${completedMaint.totalCount || 0} Servis`, color: 'text-amber-600 bg-amber-50 border-amber-200' },
        { id: 'BUS_OMSET', label: '5. Sisa Omset Bus', icon: DollarSign, count: `Rp ${Math.round((busOmset.sisaOmset || 0) / 1000).toLocaleString('id-ID')}k`, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
        { id: 'DRIVERS', label: '6. Top Driver', icon: Trophy, count: `${topDrivers.length} Supir`, color: 'text-amber-600 bg-amber-50 border-amber-200' },
        { id: 'VIOLATIONS', label: '7. Diskrepansi & Akun Sanksi', icon: ShieldAlert, count: `${violations.totalViolations || 0} Kasus`, color: 'text-rose-600 bg-rose-50 border-rose-200' },
    ];

    return (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6 mt-6">
            {/* Header Hub 7 Laporan */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-700 uppercase tracking-widest">
                            Modul Analisis Terpadu
                        </span>
                        <span className="text-xs font-bold text-slate-400">
                            Periode: {periodLabel || 'Semua Periode'}
                        </span>
                    </div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2 mt-1">
                        📊 Laporan 7 Indikator Utama Manajemen Armada
                    </h2>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Statistik mobilitas, konsumsi BBM armada aktif, omset bus, realisasi pemeliharaan, peringkat supir, dan audit pelanggaran rentang tanggal.
                    </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    {/* 1. Ekspor PDF (7 Indikator) */}
                    <button
                        onClick={handleExportSevenReportsPDF}
                        disabled={exportingPdf || exportingDoc}
                        className="px-4 py-2.5 bg-gradient-to-r from-rose-600 via-rose-700 to-rose-800 hover:from-rose-700 hover:to-rose-900 text-white rounded-2xl text-xs font-black uppercase tracking-tight shadow-md shadow-rose-200 transition-all flex items-center gap-2 disabled:opacity-50"
                        title="Unduh laporan gabungan 7 indikator dalam format PDF resmi"
                    >
                        {exportingPdf ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                        {exportingPdf ? 'Mengekspor PDF...' : 'Ekspor PDF (7 Indikator)'}
                    </button>

                    {/* 2. Ekspor DOC (7 Indikator) */}
                    <button
                        onClick={handleExportSevenReportsDOC}
                        disabled={exportingPdf || exportingDoc}
                        className="px-4 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-700 to-indigo-800 hover:from-blue-700 hover:to-indigo-900 text-white rounded-2xl text-xs font-black uppercase tracking-tight shadow-md shadow-blue-200 transition-all flex items-center gap-2 disabled:opacity-50"
                        title="Unduh laporan gabungan 7 indikator dalam format Word / DOC"
                    >
                        {exportingDoc ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                        {exportingDoc ? 'Mengekspor DOC...' : 'Ekspor DOC (7 Indikator)'}
                    </button>

                    {/* 3. Analisis AI */}
                    <button
                        onClick={handleGenerateAI}
                        disabled={aiLoading}
                        className="px-4 py-2.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 text-white rounded-2xl text-xs font-black uppercase tracking-tight shadow-md shadow-purple-200 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                        {aiLoading ? 'Menganalisis...' : 'Analisis AI Eksekutif'}
                    </button>
                </div>
            </div>

            {/* Quick 7 KPI Cards / Sub-tab Switchers */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
                {subTabs.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeSubTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => {
                                setActiveSubTab(tab.id);
                                setSearchQuery('');
                            }}
                            className={`p-3 rounded-2xl text-left transition-all border flex flex-col justify-between ${
                                isActive
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100 ring-2 ring-indigo-400/30'
                                    : 'bg-slate-50/70 hover:bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className={`p-1.5 rounded-xl ${isActive ? 'bg-white/20 text-white' : tab.color}`}>
                                    <Icon size={16} />
                                </div>
                                <span className={`text-[10px] font-mono font-black ${isActive ? 'text-indigo-100' : 'text-slate-500'}`}>
                                    {tab.count}
                                </span>
                            </div>
                            <span className="text-[11px] font-black tracking-tight line-clamp-1 leading-tight">
                                {tab.label}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Search & Sub-bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                    <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                        {subTabs.find(t => t.id === activeSubTab)?.icon && (() => {
                            const CurrIcon = subTabs.find(t => t.id === activeSubTab).icon;
                            return <CurrIcon size={15} />;
                        })()}
                    </span>
                    <span className="text-slate-800 font-black">
                        {subTabs.find(t => t.id === activeSubTab)?.label}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative flex-1 sm:w-64">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Cari armada, supir, unit..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                <X size={12} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* =========================================================================
                TAB 1: JUMLAH PERJALANAN MASING-MASING KENDARAAN (AKTIF SAJA)
            ========================================================================= */}
            {activeSubTab === 'TRIPS' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    {/* Summary Metric Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100">
                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block">Armada Aktif Terdata</span>
                            <span className="text-xl font-black text-indigo-950 mt-1 block">{activeTrips.length} Unit</span>
                            <span className="text-[10px] text-indigo-500 font-bold">Hanya kendaraan status aktif</span>
                        </div>
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Total Perjalanan</span>
                            <span className="text-xl font-black text-slate-900 mt-1 block">
                                {activeTrips.reduce((s, v) => s + v.tripCount, 0).toLocaleString('id-ID')} Trip
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold">Akumulasi periode terpilih</span>
                        </div>
                        <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100">
                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block">Akumulasi Jarak Tempuh</span>
                            <span className="text-xl font-black text-emerald-950 mt-1 block">
                                {Math.round(activeTrips.reduce((s, v) => s + v.totalKm, 0)).toLocaleString('id-ID')} KM
                            </span>
                            <span className="text-[10px] text-emerald-600 font-bold">Total jarak tempuh unit aktif</span>
                        </div>
                        <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-100">
                            <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest block">Rata-Rata per Unit</span>
                            <span className="text-xl font-black text-purple-950 mt-1 block">
                                {activeTrips.length > 0 ? (activeTrips.reduce((s, v) => s + v.tripCount, 0) / activeTrips.length).toFixed(1) : 0} Trip
                            </span>
                            <span className="text-[10px] text-purple-600 font-bold">Frekuensi mobilitas rata-rata</span>
                        </div>
                    </div>

                    {/* Bar Chart: Jumlah Perjalanan per Kendaraan Aktif */}
                    {activeTrips.length > 0 && (
                        <div className="p-5 rounded-2xl border border-slate-100 bg-slate-50/40">
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <TrendingUp size={15} className="text-indigo-600" />
                                Grafik Perbandingan Jumlah Perjalanan Kendaraan Aktif
                            </h4>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={activeTrips} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} interval={0} angle={-15} textAnchor="end" height={40} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 20px -5px rgba(0,0,0,0.1)', fontSize: '11px', fontWeight: 'bold' }}
                                            formatter={(val, name) => name === 'tripCount' ? [`${val} Perjalanan`, 'Jumlah Perjalanan'] : [`${val.toLocaleString('id-ID')} KM`, 'Total Jarak']}
                                        />
                                        <Bar dataKey="tripCount" fill="#4f46e5" radius={[6, 6, 0, 0]} name="tripCount" barSize={28}>
                                            {activeTrips.map((_, idx) => (
                                                <Cell key={`cell-${idx}`} fill={idx === 0 ? '#4338ca' : '#6366f1'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* Table Data */}
                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black uppercase text-[10px] tracking-wider">
                                <tr>
                                    <th className="py-3 px-4 text-center w-12">#</th>
                                    <th className="py-3 px-4">Armada Kendaraan</th>
                                    <th className="py-3 px-4">Plat Nomor</th>
                                    <th className="py-3 px-4 text-center">Jumlah Perjalanan</th>
                                    <th className="py-3 px-4 text-right">Total Jarak Tempuh</th>
                                    <th className="py-3 px-4 text-center">Tingkat Utilisasi</th>
                                    <th className="py-3 px-4 text-center">Status Operasional</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                                {filteredTrips.map((v, i) => (
                                    <tr key={v.id || i} className="hover:bg-indigo-50/20 transition-colors">
                                        <td className="py-3 px-4 text-center font-bold text-slate-400">
                                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                                        </td>
                                        <td className="py-3 px-4 font-black text-slate-900">
                                            {v.name}
                                        </td>
                                        <td className="py-3 px-4 font-mono font-bold text-slate-500">
                                            <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{v.plate}</span>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 font-black">
                                                {v.tripCount} Trip
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-right font-black text-indigo-600 font-mono">
                                            {Math.round(v.totalKm || 0).toLocaleString('id-ID')} KM
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <span className="font-bold text-[11px] w-8 text-right">{v.utilization?.toFixed(0)}%</span>
                                                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(v.utilization || 0, 100)}%` }} />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                                                Aktif
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {filteredTrips.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                                            Tidak ada kendaraan aktif ditemukan.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* =========================================================================
                TAB 2: BBM YANG DIKELUARKAN MASING-MASING KENDARAAN (AKTIF SAJA)
            ========================================================================= */}
            {activeSubTab === 'FUEL' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-4 rounded-2xl bg-sky-50/60 border border-sky-100">
                            <span className="text-[10px] font-black text-sky-600 uppercase tracking-widest block">Total Biaya BBM</span>
                            <span className="text-xl font-black text-sky-950 mt-1 block">
                                Rp {Math.round(activeFuels.reduce((s, v) => s + v.fuelCost, 0)).toLocaleString('id-ID')}
                            </span>
                            <span className="text-[10px] text-sky-600 font-bold">Armada aktif saja</span>
                        </div>
                        <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100">
                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block">Rata-Rata Belanja/Unit</span>
                            <span className="text-xl font-black text-indigo-950 mt-1 block">
                                Rp {activeFuels.length > 0 ? Math.round(activeFuels.reduce((s, v) => s + v.fuelCost, 0) / activeFuels.length).toLocaleString('id-ID') : 0}
                            </span>
                            <span className="text-[10px] text-indigo-500 font-bold">Rata-rata per kendaraan aktif</span>
                        </div>
                        <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-100">
                            <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest block">Armada Mengisi BBM</span>
                            <span className="text-xl font-black text-amber-950 mt-1 block">
                                {activeFuels.filter(v => v.fuelCost > 0).length} / {activeFuels.length} Unit
                            </span>
                            <span className="text-[10px] text-amber-600 font-bold">Unit aktif bertransaksi BBM</span>
                        </div>
                    </div>

                    {/* Chart: Belanja BBM per Kendaraan Aktif */}
                    {activeFuels.length > 0 && (
                        <div className="p-5 rounded-2xl border border-slate-100 bg-slate-50/40">
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <Fuel size={15} className="text-sky-600" />
                                Grafik Belanja BBM Masing-Masing Kendaraan Aktif (Rp)
                            </h4>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={activeFuels} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} interval={0} angle={-15} textAnchor="end" height={40} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(val) => `Rp ${(val / 1000).toLocaleString('id-ID')}k`} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 20px -5px rgba(0,0,0,0.1)', fontSize: '11px', fontWeight: 'bold' }}
                                            formatter={(val) => [`Rp ${Math.round(val).toLocaleString('id-ID')}`, 'Biaya BBM']}
                                        />
                                        <Bar dataKey="fuelCost" fill="#0284c7" radius={[6, 6, 0, 0]} name="fuelCost" barSize={28} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* Table Data BBM Tanpa Metrik Efisiensi & Tanpa Liter */}
                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black uppercase text-[10px] tracking-wider">
                                <tr>
                                    <th className="py-3 px-4 text-center w-12">#</th>
                                    <th className="py-3 px-4">Armada Kendaraan</th>
                                    <th className="py-3 px-4">Plat Nomor</th>
                                    <th className="py-3 px-4">Tipe Kendaraan</th>
                                    <th className="py-3 px-4 text-right">Total Biaya BBM</th>
                                    <th className="py-3 px-4 text-center">Status Transaksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                                {filteredFuels.map((v, i) => (
                                    <tr key={v.id || i} className="hover:bg-sky-50/20 transition-colors">
                                        <td className="py-3 px-4 text-center font-bold text-slate-400">{i + 1}</td>
                                        <td className="py-3 px-4 font-black text-slate-900">{v.name}</td>
                                        <td className="py-3 px-4 font-mono font-bold text-slate-500">
                                            <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{v.plate}</span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-700">
                                                {v.type || 'KENDARAAN'}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-right font-black text-sky-700 font-mono">
                                            Rp {Math.round(v.fuelCost || 0).toLocaleString('id-ID')}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            {v.fuelCost > 0 ? (
                                                 <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-sky-100 text-sky-800 uppercase tracking-wider">
                                                     Tercatat
                                                 </span>
                                            ) : (
                                                 <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-500">
                                                     Nihil
                                                 </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {filteredFuels.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                                            Tidak ada data transaksi BBM kendaraan aktif ditemukan.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            {filteredFuels.length > 0 && (
                                <tfoot className="bg-sky-50/50 border-t-2 border-sky-100 font-black text-slate-800 text-xs">
                                    <tr>
                                        <td colSpan={4} className="py-3 px-4 text-right text-sky-900 uppercase tracking-wider text-[11px]">
                                            Total Pengeluaran BBM Armada Aktif:
                                        </td>
                                        <td className="py-3 px-4 text-right font-mono text-sky-800 text-sm">
                                            Rp {Math.round(activeFuels.reduce((s, v) => s + v.fuelCost, 0)).toLocaleString('id-ID')}
                                        </td>
                                        <td className="py-3 px-4 text-center text-[10px] text-slate-500 font-bold">
                                            {activeFuels.filter(v => v.fuelCost > 0).length} Unit
                                        </td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            )}

            {/* =========================================================================
                TAB 3: JUMLAH BOOKINGAN BUS
            ========================================================================= */}
            {activeSubTab === 'BUS_BOOKINGS' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-100">
                            <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest block">Total Booking Bus</span>
                            <span className="text-xl font-black text-purple-950 mt-1 block">{busBookings.total || 0} Agenda</span>
                            <span className="text-[10px] text-purple-500 font-bold">Semua status</span>
                        </div>
                        <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100">
                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block">Selesai (Completed)</span>
                            <span className="text-xl font-black text-emerald-950 mt-1 block">{busBookings.statusCounts?.COMPLETED || 0} Trip</span>
                            <span className="text-[10px] text-emerald-600 font-bold">Perjalanan terlaksana</span>
                        </div>
                        <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100">
                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest block">Disetujui / Berjalan</span>
                            <span className="text-xl font-black text-blue-950 mt-1 block">{busBookings.statusCounts?.APPROVED || 0} Agenda</span>
                            <span className="text-[10px] text-blue-500 font-bold">Siap jalan / aktif</span>
                        </div>
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Total Penumpang</span>
                            <span className="text-xl font-black text-slate-900 mt-1 block">{busBookings.totalPassengers || 0} Orang</span>
                            <span className="text-[10px] text-slate-400 font-bold">Kapasitas mobilitas</span>
                        </div>
                        <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-100">
                            <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest block">Dibatalkan</span>
                            <span className="text-xl font-black text-rose-950 mt-1 block">{busBookings.statusCounts?.CANCELLED || 0} Booking</span>
                            <span className="text-[10px] text-rose-500 font-bold">Batal / Nonaktif</span>
                        </div>
                    </div>

                    {/* Breakdown per Armada Bus */}
                    {busBookings.byVehicle && busBookings.byVehicle.length > 0 && (
                        <div>
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <Bus size={15} className="text-purple-600" />
                                Distribusi Bookingan Berdasarkan Unit Armada Bus
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {busBookings.byVehicle.map((bv, idx) => (
                                    <div key={idx} className="p-4 rounded-2xl border border-purple-100 bg-purple-50/30 flex items-center justify-between">
                                        <div>
                                            <h5 className="font-black text-slate-900 text-xs">{bv.name}</h5>
                                            <span className="text-[10px] font-mono text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200 mt-1 inline-block">
                                                {bv.plate}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-sm font-black text-purple-700 block">{bv.count} Booking</span>
                                            <span className="text-[10px] font-mono text-slate-500 block">Rp {Math.round(bv.totalBill || 0).toLocaleString('id-ID')}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Table Daftar Bookingan Bus */}
                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black uppercase text-[10px] tracking-wider">
                                <tr>
                                    <th className="py-3 px-4">Jadwal Keberangkatan</th>
                                    <th className="py-3 px-4">Armada Bus</th>
                                    <th className="py-3 px-4">Pemesan & Unit</th>
                                    <th className="py-3 px-4">Tujuan</th>
                                    <th className="py-3 px-4">Driver Bertugas</th>
                                    <th className="py-3 px-4 text-center">Penumpang</th>
                                    <th className="py-3 px-4 text-right">Tagihan Sewa</th>
                                    <th className="py-3 px-4 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                                {filteredBusList.map((b, i) => {
                                    const sStr = new Date(b.startDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
                                    const eStr = new Date(b.endDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
                                    const isDone = b.status === 'COMPLETED';
                                    const isCancelled = b.status === 'CANCELLED';

                                    return (
                                        <tr key={b.id || i} className="hover:bg-purple-50/20 transition-colors">
                                            <td className="py-3 px-4 font-bold text-indigo-700 font-mono whitespace-nowrap">
                                                {sStr} {sStr !== eStr ? `- ${eStr}` : ''}
                                            </td>
                                            <td className="py-3 px-4 font-black text-slate-900">
                                                <div>{b.vehicle?.name || 'Bus Operasional'}</div>
                                                <div className="text-[10px] font-mono text-slate-400">{b.vehicle?.plateNumber}</div>
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="font-bold text-slate-800">{b.requesterName || b.user?.name || '-'}</div>
                                                <div className="text-[10px] text-slate-400">{b.unit || b.user?.unit?.name || 'Umum'}</div>
                                            </td>
                                            <td className="py-3 px-4 font-medium text-slate-700 max-w-[150px] truncate" title={b.destination}>
                                                {b.destination}
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                    b.driver?.name ? 'bg-slate-100 text-slate-800' : 'bg-amber-50 text-amber-700 italic'
                                                }`}>
                                                    {b.driver?.name || 'Belum Ditugaskan'}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-center font-mono font-bold">
                                                {b.passengerCount || 0} org
                                            </td>
                                            <td className="py-3 px-4 text-right font-mono font-black text-slate-800">
                                                {b.totalBill > 0 ? `Rp ${Math.round(b.totalBill).toLocaleString('id-ID')}` : '-'}
                                                {b.isPaid && <span className="block text-[9px] text-emerald-600 font-bold">LUNAS</span>}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                    isDone ? 'bg-emerald-100 text-emerald-800' : isCancelled ? 'bg-slate-100 text-slate-500' : 'bg-purple-100 text-purple-800'
                                                }`}>
                                                    {b.status}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredBusList.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                                            Tidak ada bookingan bus dalam periode ini.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* =========================================================================
                TAB 4: PEMELIHARAAN YANG TERLAKSANA
            ========================================================================= */}
            {activeSubTab === 'MAINTENANCE' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-100">
                            <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest block">Pemeliharaan Terlaksana</span>
                            <span className="text-xl font-black text-amber-950 mt-1 block">
                                {completedMaint.totalCount || 0} Servis
                            </span>
                            <span className="text-[10px] text-amber-600 font-bold">Status COMPLETED</span>
                        </div>
                        <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-100">
                            <span className="text-[10px] font-black text-rose-700 uppercase tracking-widest block">Total Biaya Bengkel</span>
                            <span className="text-xl font-black text-rose-950 mt-1 block">
                                Rp {Math.round(completedMaint.totalCost || 0).toLocaleString('id-ID')}
                            </span>
                            <span className="text-[10px] text-rose-600 font-bold">Realisasi pengeluaran servis</span>
                        </div>
                        <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100">
                            <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest block">Rata-Rata Biaya/Servis</span>
                            <span className="text-xl font-black text-indigo-950 mt-1 block">
                                {completedMaint.totalCount > 0 ? `Rp ${Math.round(completedMaint.totalCost / completedMaint.totalCount).toLocaleString('id-ID')}` : 'Rp 0'}
                            </span>
                            <span className="text-[10px] text-indigo-500 font-bold">Biaya per kegiatan servis</span>
                        </div>
                        <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100">
                            <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest block">Unit yang Diservis</span>
                            <span className="text-xl font-black text-emerald-950 mt-1 block">
                                {completedMaint.byVehicle?.length || 0} Unit
                            </span>
                            <span className="text-[10px] text-emerald-600 font-bold">Armada masuk bengkel</span>
                        </div>
                    </div>

                    {/* Breakdown Kategori Servis */}
                    {completedMaint.byType && completedMaint.byType.length > 0 && (
                        <div>
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <Wrench size={15} className="text-amber-600" />
                                Kategori Pemeliharaan Terlaksana
                            </h4>
                            <div className="flex flex-wrap gap-2.5">
                                {completedMaint.byType.map((t, idx) => (
                                    <div key={idx} className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center gap-2">
                                        <span className="font-black text-slate-800">{t.type}</span>
                                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-black text-[10px]">{t.count}x</span>
                                        <span className="text-slate-400 font-mono text-[11px]">Rp {Math.round(t.totalCost).toLocaleString('id-ID')}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Table Daftar Pemeliharaan Terlaksana */}
                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black uppercase text-[10px] tracking-wider">
                                <tr>
                                    <th className="py-3 px-4">Tanggal Selesai</th>
                                    <th className="py-3 px-4">Kendaraan</th>
                                    <th className="py-3 px-4">Kategori / Jenis</th>
                                    <th className="py-3 px-4">Uraian Servis / Perbaikan</th>
                                    <th className="py-3 px-4">Bengkel Rekanan</th>
                                    <th className="py-3 px-4 text-right">Biaya Realisasi</th>
                                    <th className="py-3 px-4 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                                {filteredMaintList.map((s, i) => (
                                    <tr key={s.id || i} className="hover:bg-amber-50/20 transition-colors">
                                        <td className="py-3 px-4 font-mono font-bold text-slate-500 whitespace-nowrap">
                                            {new Date(s.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td className="py-3 px-4 font-black text-slate-900">
                                            <div>{s.vehicle?.name || 'Kendaraan'}</div>
                                            <div className="text-[10px] font-mono text-slate-400">{s.vehicle?.plateNumber}</div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 uppercase tracking-wider">
                                                {s.type || s.category}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 font-medium text-slate-700 max-w-xs truncate" title={s.description}>
                                            {s.description || '-'}
                                        </td>
                                        <td className="py-3 px-4 text-slate-600 font-medium">
                                            {s.workshop || 'Bengkel Rekanan'}
                                        </td>
                                        <td className="py-3 px-4 text-right font-black text-rose-700 font-mono">
                                            Rp {Math.round(s.cost || 0).toLocaleString('id-ID')}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                                                Terlaksana
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {filteredMaintList.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                                            Tidak ada pemeliharaan terlaksana dalam periode ini.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* =========================================================================
                TAB 5: SISA OMSET BUS (PEMASUKAN VS PENGELUARAN)
            ========================================================================= */}
            {activeSubTab === 'BUS_OMSET' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    {/* Big Profitability Banner */}
                    <div className="p-6 rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900 text-white shadow-xl shadow-emerald-900/10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-white/20 backdrop-blur-md text-emerald-100 inline-block mb-2">
                                Saldo & Sisa Omset Bersih Bus
                            </span>
                            <h3 className="text-3xl font-black tracking-tight">
                                Rp {Math.round(busOmset.sisaOmset || 0).toLocaleString('id-ID')}
                            </h3>
                            <p className="text-emerald-100 text-xs font-medium mt-1">
                                Total Pemasukan Bersih dikurangi Biaya BBM, Servis Bengkel, dan Biaya Tak Terduga Bus Operasional.
                            </p>
                        </div>

                        <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 text-center sm:text-right shrink-0">
                            <span className="text-[10px] font-black text-emerald-200 uppercase tracking-widest block">Margin Keuntungan</span>
                            <span className="text-2xl font-black text-white mt-0.5 block">{busOmset.marginPercent || 0}%</span>
                            <span className="text-[10px] text-emerald-100 font-bold">Rasio Net terhadap Omset</span>
                        </div>
                    </div>

                    {/* Breakdown 2 Columns: Pemasukan vs Pengeluaran */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Pemasukan */}
                        <div className="p-5 rounded-2xl border border-emerald-200 bg-emerald-50/30 space-y-3">
                            <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2.5">
                                <h4 className="text-xs font-black text-emerald-900 uppercase tracking-wider flex items-center gap-2">
                                    <TrendingUp size={16} className="text-emerald-600" /> Total Pemasukan Bus
                                </h4>
                                <span className="font-mono font-black text-sm text-emerald-700">
                                    Rp {Math.round(busOmset.totalRevenue || 0).toLocaleString('id-ID')}
                                </span>
                            </div>
                            <div className="space-y-2 text-xs">
                                <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-emerald-100">
                                    <span className="font-bold text-slate-700">1. Pendapatan Sewa / Booking Bus</span>
                                    <span className="font-mono font-bold text-slate-900">Rp {Math.round(busOmset.bookingRevenue || 0).toLocaleString('id-ID')}</span>
                                </div>
                                <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-emerald-100">
                                    <span className="font-bold text-slate-700">2. Pemasukan Lainnya (Other Income)</span>
                                    <span className="font-mono font-bold text-slate-900">Rp {Math.round(busOmset.otherIncome || 0).toLocaleString('id-ID')}</span>
                                </div>
                            </div>
                        </div>

                        {/* Pengeluaran */}
                        <div className="p-5 rounded-2xl border border-rose-200 bg-rose-50/30 space-y-3">
                            <div className="flex items-center justify-between border-b border-rose-200/60 pb-2.5">
                                <h4 className="text-xs font-black text-rose-900 uppercase tracking-wider flex items-center gap-2">
                                    <Wrench size={16} className="text-rose-600" /> Total Pengeluaran Bus
                                </h4>
                                <span className="font-mono font-black text-sm text-rose-700">
                                    Rp {Math.round(busOmset.totalExpenses || 0).toLocaleString('id-ID')}
                                </span>
                            </div>
                            <div className="space-y-2 text-xs">
                                <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-rose-100">
                                    <span className="font-bold text-slate-700">1. Belanja Bahan Bakar (BBM Bus)</span>
                                    <span className="font-mono font-bold text-slate-900">Rp {Math.round(busOmset.fuelExpenses || 0).toLocaleString('id-ID')}</span>
                                </div>
                                <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-rose-100">
                                    <span className="font-bold text-slate-700">2. Pemeliharaan & Servis Bengkel</span>
                                    <span className="font-mono font-bold text-slate-900">Rp {Math.round(busOmset.maintenanceExpenses || 0).toLocaleString('id-ID')}</span>
                                </div>
                                <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-rose-100">
                                    <span className="font-bold text-slate-700">3. Biaya Tak Terduga (Unexpected)</span>
                                    <span className="font-mono font-bold text-slate-900">Rp {Math.round(busOmset.unexpectedExpenses || 0).toLocaleString('id-ID')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* =========================================================================
                TAB 6: TOP DRIVER (LEADERBOARD SUPIR)
            ========================================================================= */}
            {activeSubTab === 'DRIVERS' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    {/* Top 3 Podium Cards */}
                    {topDrivers.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {topDrivers.slice(0, 3).map((driver, idx) => {
                                const rankColors = [
                                    'from-amber-500 to-yellow-600 border-amber-300 text-white',
                                    'from-slate-400 to-slate-500 border-slate-300 text-white',
                                    'from-amber-700 to-amber-800 border-amber-600 text-white'
                                ];
                                const medals = ['🥇 Top Driver #1', '🥈 Driver Terpilih #2', '🥉 Driver Terpilih #3'];

                                return (
                                    <div key={driver.id || idx} className="p-4 rounded-2xl border bg-white shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100">
                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r ${rankColors[idx]}`}>
                                                    {medals[idx]}
                                                </span>
                                                <span className="text-[10px] font-black text-slate-400">{driver.unit}</span>
                                            </div>
                                            <h4 className="text-sm font-black text-slate-900">{driver.name}</h4>
                                            <p className="text-xs text-slate-500 font-medium">{driver.position}</p>
                                            {driver.phone && <p className="text-[11px] font-mono text-slate-400 mt-1">📞 {driver.phone}</p>}
                                        </div>

                                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                                            <div>
                                                <span className="text-[10px] text-slate-400 block font-bold uppercase">Total Trip</span>
                                                <span className="text-base font-black text-indigo-700">{driver.totalTrips} Perjalanan</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[10px] text-slate-400 block font-bold uppercase">Total KM</span>
                                                <span className="text-sm font-mono font-bold text-slate-800">{Math.round(driver.totalKm).toLocaleString('id-ID')} KM</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Leaderboard Table */}
                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black uppercase text-[10px] tracking-wider">
                                <tr>
                                    <th className="py-3 px-4 text-center w-12">Peringkat</th>
                                    <th className="py-3 px-4">Nama Driver / Supir</th>
                                    <th className="py-3 px-4">Kontak / Unit</th>
                                    <th className="py-3 px-4 text-center">Trip Mobil Dinas</th>
                                    <th className="py-3 px-4 text-center">Trip Bus</th>
                                    <th className="py-3 px-4 text-center">Total Perjalanan</th>
                                    <th className="py-3 px-4 text-right">Total Jarak Tempuh</th>
                                    <th className="py-3 px-4 text-center">Pelanggaran</th>
                                    <th className="py-3 px-4 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                                {filteredDrivers.map((d, i) => (
                                    <tr key={d.id || i} className="hover:bg-amber-50/20 transition-colors">
                                        <td className="py-3 px-4 text-center font-black">
                                            <span className={`w-6 h-6 inline-flex items-center justify-center rounded-lg text-xs ${
                                                i === 0 ? 'bg-amber-500 text-white font-black' : i === 1 ? 'bg-slate-400 text-white' : i === 2 ? 'bg-amber-700 text-white' : 'bg-slate-100 text-slate-600'
                                            }`}>
                                                {d.rank || i + 1}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 font-black text-slate-900">
                                            {d.name}
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="text-slate-800 font-bold">{d.unit || 'Sarpras'}</div>
                                            <div className="text-[10px] font-mono text-slate-400">{d.phone || '-'}</div>
                                        </td>
                                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-600">
                                            {d.vehicleTrips}x
                                        </td>
                                        <td className="py-3 px-4 text-center font-mono font-bold text-purple-700">
                                            {d.busTrips}x
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-800 font-black">
                                                {d.totalTrips} Perjalanan
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                                            {Math.round(d.totalKm || 0).toLocaleString('id-ID')} KM
                                        </td>
                                        <td className="py-3 px-4 text-center font-mono font-bold">
                                            {d.violationCount === 0 ? (
                                                <span className="text-emerald-600">0 (Tertib)</span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black">
                                                    {d.violationCount}x
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                                                Siap Bertugas
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {filteredDrivers.length === 0 && (
                                    <tr>
                                        <td colSpan={9} className="py-8 text-center text-slate-400 italic">
                                            Tidak ada data driver ditemukan.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* =========================================================================
                TAB 7: AUDIT PELANGGARAN (1. DISKREPANSI & 2. AKUN DISANKSI)
                (Sesuai instruksi: BUKAN keterlambatan mulai atau pengembalian)
            ========================================================================= */}
            {activeSubTab === 'VIOLATIONS' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    {/* 4 KPI Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200">
                            <span className="text-[10px] font-black text-rose-700 uppercase tracking-widest block">Total Pelanggaran Operasional</span>
                            <span className="text-xl font-black text-rose-950 mt-1 block">
                                {violations.totalViolations || 0} Kasus
                            </span>
                            <span className="text-[10px] text-rose-600 font-bold">Diskrepansi &amp; Akun Disanksi</span>
                        </div>
                        <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200">
                            <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest block">Diskrepansi Odometer</span>
                            <span className="text-xl font-black text-amber-950 mt-1 block">
                                {violations.discrepancyCount || 0} Insiden
                            </span>
                            <span className="text-[10px] text-amber-600 font-bold">Selisih odometer &gt; 1 KM</span>
                        </div>
                        <div className="p-4 rounded-2xl bg-red-100/70 border border-red-300">
                            <span className="text-[10px] font-black text-red-800 uppercase tracking-widest block">Total KM Luar Sistem</span>
                            <span className="text-xl font-black text-red-950 mt-1 block">
                                +{(violations.totalDiscrepancyKm || 0).toLocaleString('id-ID')} KM
                            </span>
                            <span className="text-[10px] text-red-700 font-bold">Akumulasi pemakaian tanpa sistem</span>
                        </div>
                        <div className="p-4 rounded-2xl bg-slate-900 text-white">
                            <span className="text-[10px] font-black text-red-400 uppercase tracking-widest block">Akun Kena Sanksi</span>
                            <span className="text-xl font-black text-white mt-1 block">
                                {violations.sanctionedCount || 0} Pengguna
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold">Hak booking dibekukan sementara</span>
                        </div>
                    </div>

                    {/* Section 1: Tabel Diskrepansi Odometer */}
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                    <Gauge size={16} className="text-rose-600" />
                                    1. Riwayat Kejadian Diskrepansi Odometer Kendaraan
                                </h3>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    Perbedaan odometer antara akhir perjalanan sebelumnya dengan awal perjalanan berikutnya (&gt; 1 KM).
                                </p>
                            </div>
                            <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black w-fit">
                                {filteredDiscrepancies.length} Kejadian Terdeteksi
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-500 font-black uppercase text-[10px] tracking-wider">
                                    <tr>
                                        <th className="py-3 px-4 text-center w-10">#</th>
                                        <th className="py-3 px-4">Waktu Terdeteksi</th>
                                        <th className="py-3 px-4">Armada &amp; Plat</th>
                                        <th className="py-3 px-4">Peminjam / Pelapor</th>
                                        <th className="py-3 px-4 text-right">KM Sistem Terakhir</th>
                                        <th className="py-3 px-4 text-right">KM Awal Input</th>
                                        <th className="py-3 px-4 text-center">Selisih (+KM)</th>
                                        <th className="py-3 px-4 text-center">Foto Bukti</th>
                                        <th className="py-3 px-4">Tujuan / Catatan</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                                    {filteredDiscrepancies.map((d, i) => {
                                        const dt = new Date(d.date);
                                        return (
                                            <tr key={d.id || i} className="hover:bg-rose-50/20 transition-colors">
                                                <td className="py-3 px-4 text-center font-bold text-slate-400">
                                                    {i + 1}
                                                </td>
                                                <td className="py-3 px-4 whitespace-nowrap">
                                                    <div className="font-bold text-slate-900">
                                                        {dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </div>
                                                    <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                                                        <Clock size={10} />
                                                        {dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="font-black text-slate-900 flex items-center gap-1.5">
                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-slate-100 text-slate-700">
                                                            {d.vehicleType || 'Mobil'}
                                                        </span>
                                                        <span>{d.vehicleName}</span>
                                                    </div>
                                                    <div className="text-[10px] font-mono text-slate-500 font-bold mt-0.5">
                                                        {d.vehiclePlate}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="font-bold text-slate-900">{d.userName}</div>
                                                    <div className="text-[10px] text-slate-400 font-medium">
                                                        {d.userUnit} &bull; {d.userPosition}
                                                    </div>
                                                    {d.userPhone && <div className="text-[10px] font-mono text-slate-400">📞 {d.userPhone}</div>}
                                                </td>
                                                <td className="py-3 px-4 text-right font-mono font-semibold text-slate-600">
                                                    {d.prevEndKm != null ? d.prevEndKm.toLocaleString('id-ID') : '-'} KM
                                                </td>
                                                <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                                                    {d.currentStartKm != null ? d.currentStartKm.toLocaleString('id-ID') : '-'} KM
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-rose-100 text-rose-700 border border-rose-200">
                                                        <AlertTriangle size={12} className="text-rose-600" />
                                                        +{d.discrepancyKm != null ? d.discrepancyKm.toLocaleString('id-ID') : 0} KM
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    {d.startPhoto ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => setPreviewPhoto({
                                                                url: getMediaUrl(d.startPhoto),
                                                                title: `${d.vehicleName} (${d.vehiclePlate})`,
                                                                date: dt.toLocaleString('id-ID'),
                                                                diff: d.discrepancyKm,
                                                                user: d.userName
                                                            })}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
                                                            title="Lihat Foto Bukti Odometer"
                                                        >
                                                            <Camera size={12} />
                                                            <span>Lihat Foto</span>
                                                        </button>
                                                    ) : (
                                                        <span className="text-[10px] text-slate-400 italic">Tanpa Foto</span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 max-w-xs truncate" title={`${d.destination} - ${d.notes}`}>
                                                    <div className="font-bold text-slate-800 truncate">{d.destination || '-'}</div>
                                                    <div className="text-[10px] text-slate-400 truncate">{d.notes || d.purpose || '-'}</div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filteredDiscrepancies.length === 0 && (
                                        <tr>
                                            <td colSpan={9} className="py-8 text-center text-emerald-600 font-bold">
                                                Alhamdulillah, tidak ada kejadian diskrepansi odometer kendaraan pada periode ini.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Section 2: Tabel Akun yang Kena Sanksi */}
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                    <ShieldAlert size={16} className="text-slate-800" />
                                    2. Daftar Akun Pengguna yang Sedang Terkena Sanksi Peminjaman
                                </h3>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    Pengguna yang hak akses peminjaman kendaraannya dibekukan akibat pelanggaran SOP atau sedang dalam peninjauan.
                                </p>
                            </div>
                            <span className="px-2.5 py-1 rounded-full bg-slate-800 text-white text-[10px] font-black w-fit">
                                {filteredSanctionedUsers.length} Akun Disanksi
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-500 font-black uppercase text-[10px] tracking-wider">
                                    <tr>
                                        <th className="py-3 px-4 text-center w-10">#</th>
                                        <th className="py-3 px-4">Nama Pengguna</th>
                                        <th className="py-3 px-4">Unit Kerja &amp; Jabatan</th>
                                        <th className="py-3 px-4">Kontak (HP)</th>
                                        <th className="py-3 px-4 text-center">Status Sanksi</th>
                                        <th className="py-3 px-4">Alasan / Catatan Peninjauan Sanksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                                    {filteredSanctionedUsers.map((u, i) => (
                                        <tr key={u.id || i} className="hover:bg-slate-50 transition-colors">
                                            <td className="py-3 px-4 text-center font-bold text-slate-400">
                                                {i + 1}
                                            </td>
                                            <td className="py-3 px-4 font-black text-slate-900">
                                                {u.name}
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="text-slate-800 font-bold">{u.unitName || u.unit?.name || 'Umum'}</div>
                                                <div className="text-[10px] text-slate-400">{u.position || 'Staff'}</div>
                                            </td>
                                            <td className="py-3 px-4 font-mono text-slate-600">
                                                {u.phone ? `📞 ${u.phone}` : '-'}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 ${
                                                    u.sanctionProposedLift ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-rose-100 text-rose-800 border border-rose-200'
                                                }`}>
                                                    <ShieldAlert size={11} /> {u.statusLabel || (u.sanctionProposedLift ? 'Menunggu Review' : 'Akun Dibekukan')}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-slate-600 font-medium">
                                                {u.sanctionLiftReason || 'Pelanggaran SOP Peminjaman Armada Kendaraan'}
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredSanctionedUsers.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="py-8 text-center text-emerald-600 font-bold">
                                                Alhamdulillah, tidak ada akun pengguna yang sedang dikenakan sanksi peminjaman.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Preview Foto Odometer */}
            {previewPhoto && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Camera size={18} className="text-rose-400" />
                                <h4 className="text-sm font-black">Bukti Foto Odometer</h4>
                            </div>
                            <button
                                onClick={() => setPreviewPhoto(null)}
                                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="p-4 bg-slate-950 flex items-center justify-center min-h-[260px] max-h-[70vh] overflow-hidden">
                            <img
                                src={previewPhoto.url}
                                alt={previewPhoto.title}
                                className="max-w-full max-h-[65vh] object-contain rounded-xl"
                            />
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
                            <div>
                                <div className="font-bold text-slate-800">{previewPhoto.title}</div>
                                <div className="text-[10px] text-slate-400">
                                    {previewPhoto.date} &bull; Peminjam: {previewPhoto.user}
                                </div>
                            </div>
                            <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-rose-100 text-rose-700 border border-rose-200">
                                +{previewPhoto.diff} KM
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* =========================================================================
                MODAL ANALISIS AI EKSEKUTIF (7 LAPORAN)
            ========================================================================= */}
            {showAiModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                        {/* Header Modal */}
                        <div className="p-6 bg-gradient-to-r from-purple-700 via-indigo-700 to-slate-900 text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-2xl">
                                    <Sparkles size={22} className="text-yellow-300 animate-pulse" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black uppercase tracking-wider flex items-center gap-2">
                                        Analisis AI Eksekutif: 7 Indikator Armada
                                    </h3>
                                    <p className="text-xs text-indigo-200 font-medium mt-0.5">
                                        Audit cerdas operasional, efisiensi BBM, omset bus, driver & kepatuhan jadwal ({periodLabel || 'Semua Periode'})
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowAiModal(false)}
                                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Content Area */}
                        <div className="p-6 overflow-y-auto flex-1 space-y-4 custom-scrollbar">
                            {aiLoading ? (
                                <div className="py-16 flex flex-col items-center justify-center text-center space-y-3">
                                    <Loader2 size={36} className="text-indigo-600 animate-spin" />
                                    <h4 className="text-sm font-black text-slate-800">Menganalisis 7 Indikator Armada...</h4>
                                    <p className="text-xs text-slate-400 max-w-sm">
                                        AI sedang mengkaji data mobilitas armada aktif, rasio belanja BBM, margin sisa omset bus, efektivitas pemeliharaan, serta mendeteksi anomali pelanggaran jadwal.
                                    </p>
                                </div>
                            ) : aiAnalysis ? (
                                <div className="space-y-4">
                                    <div className="p-5 rounded-2xl bg-indigo-50/50 border border-indigo-100">
                                        {renderFormattedAiText(aiAnalysis)}
                                    </div>
                                </div>
                            ) : (
                                <div className="py-12 text-center text-slate-400 text-xs">
                                    Tidak ada hasil analisis yang tersedia.
                                </div>
                            )}
                        </div>

                        {/* Footer Modal */}
                        <div className="p-4 px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleCopyAi}
                                    disabled={!aiAnalysis || aiLoading}
                                    className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50"
                                >
                                    {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                                    {copied ? 'Tersalin' : 'Salin Analisis'}
                                </button>
                                <button
                                    onClick={handleGenerateAI}
                                    disabled={aiLoading}
                                    className="px-3 py-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 text-xs font-black rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50"
                                >
                                    <Sparkles size={14} /> Analisis Ulang
                                </button>
                            </div>

                            <button
                                onClick={() => setShowAiModal(false)}
                                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-black rounded-xl transition-all"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
