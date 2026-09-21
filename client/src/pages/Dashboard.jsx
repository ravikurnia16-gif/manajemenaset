import { useState, useEffect } from 'react';
import {
    Box, DollarSign, AlertTriangle, AlertCircle, CheckCircle2,
    TrendingDown, TrendingUp, Loader2, Download, CalendarRange,
    Sparkles, RefreshCw, Layers, Wrench, ArrowLeftRight,
    Handshake, Trash2, Building2, Activity, ShieldCheck, Check, Lightbulb, X
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import api from '../lib/axios';
import { cn } from '../lib/utils';
import WeeklyAssetReport from '../components/WeeklyAssetReport';

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

const StatCard = ({ title, value, icon: Icon, color, desc, subBadge }) => (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-start justify-between relative overflow-hidden group hover:shadow-md transition-all">
        <div>
            <div className="flex items-center gap-1.5 mb-1">
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">{title}</p>
                {subBadge && (
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {subBadge}
                    </span>
                )}
            </div>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">{value}</h3>
            {desc && <p className="text-xs text-slate-400 mt-1 font-medium">{desc}</p>}
        </div>
        <div className={cn("p-3 rounded-xl text-white shadow-sm flex items-center justify-center", color)}>
            <Icon size={22} />
        </div>
    </div>
);

const Dashboard = () => {
    const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'weekly'
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filterUnit, setFilterUnit] = useState('all');
    const [chartMode, setChartMode] = useState('count');
    const [exporting, setExporting] = useState(false);

    // AI Summary State
    const [aiSummary, setAiSummary] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState(null);
    const [showAiAnalysis, setShowAiAnalysis] = useState(false);

    const userStr = localStorage.getItem('user');
    const currentUser = userStr ? JSON.parse(userStr) : {};
    const canFilterUnit = ['SUPER_ADMIN', 'BIDANG_IT', 'ADMIN_ASET'].includes(currentUser.role);
    const pos = (currentUser?.position || '').toLowerCase();
    const role = currentUser?.role || '';
    const isKepalaBidangSarana = role === 'KABID_SARPRAS' || pos.includes('kepala bidang sarana') || pos.includes('kabid sarpras') || currentUser?.position === 'Kepala Bidang Sarana';
    const isAdminAset = role === 'ADMIN_ASET' || pos.includes('admin aset');
    const canAccessWeeklyReport = ['SUPER_ADMIN', 'ADMIN_ASET', 'BIDANG_IT', 'KABID_SARPRAS'].includes(currentUser.role) || isKepalaBidangSarana || isAdminAset;

    const fetchStats = async () => {
        try {
            setLoading(true);
            const params = filterUnit !== 'all' ? { unitId: filterUnit } : {};
            const response = await api.get('/dashboard/stats', { params });
            setData(response.data);
        } catch (err) {
            console.error('Failed to fetch dashboard stats:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchAiSummary = async () => {
        try {
            setAiLoading(true);
            setAiError(null);
            const params = filterUnit !== 'all' ? { unitId: filterUnit } : {};
            const response = await api.get('/dashboard/ai-summary', { params });
            const result = response.data?.data || response.data;
            setAiSummary({
                executiveSummary: result.summary || result.executiveSummary || 'Sistem manajemen aset beroperasi stabil dengan pemantauan terpadu.',
                healthScore: result.healthScore ?? 85,
                healthCategory: result.healthCategory || 'Baik',
                keyInsights: result.criticalFindings || result.keyInsights || [],
                recommendations: result.strategicRecommendations || result.recommendations || [],
                source: response.data?.success ? 'gemini_ai' : 'rule_based'
            });
        } catch (err) {
            console.error('Failed to load AI summary:', err);
            setAiError(err.response?.data?.message || err.message || 'Gagal memuat analisis AI');
        } finally {
            setAiLoading(false);
        }
    };

    const handleToggleAiAnalysis = () => {
        const nextState = !showAiAnalysis;
        setShowAiAnalysis(nextState);
        if (nextState && !aiSummary && !aiLoading) {
            fetchAiSummary();
        }
    };

    useEffect(() => {
        fetchStats();
        if (showAiAnalysis && isKepalaBidangSarana) {
            fetchAiSummary();
        }
    }, [filterUnit]);

    if (loading && !data) return (
        <div className="flex h-96 items-center justify-center">
            <Loader2 className="animate-spin text-indigo-600" size={40} />
        </div>
    );

    // 6 CORE METRICS REQUESTED BY USER:
    // 1. Total Aset
    // 2. Kondisi Baik
    // 3. Rusak Ringan
    // 4. Rusak Berat
    // 5. Nilai Buku
    // 6. Nilai Pasar
    const stats = [
        {
            title: "Total Aset",
            value: (data?.stats?.totalAssets || 0).toLocaleString('id-ID') + " Unit",
            icon: Box,
            color: "bg-blue-600",
            desc: "Total fisik terinventarisasi",
            subBadge: "Semua"
        },
        {
            title: "Kondisi Baik",
            value: (data?.stats?.goodAssets || 0).toLocaleString('id-ID') + " Unit",
            icon: CheckCircle2,
            color: "bg-emerald-600",
            desc: "Siap operasional optimal",
            subBadge: "Layak Pakai"
        },
        {
            title: "Rusak Ringan",
            value: (data?.stats?.lightDamagedAssets || 0).toLocaleString('id-ID') + " Unit",
            icon: AlertCircle,
            color: "bg-amber-500",
            desc: "Dapat diperbaiki / servis rutin",
            subBadge: "Perlu Servis"
        },
        {
            title: "Rusak Berat",
            value: (data?.stats?.heavyDamagedAssets || 0).toLocaleString('id-ID') + " Unit",
            icon: AlertTriangle,
            color: "bg-rose-600",
            desc: "Usulan lelang / pemusnahan",
            subBadge: "Kritis"
        },
        {
            title: "Nilai Buku (Terkini)",
            value: `Rp ${(data?.stats?.totalBookValue ?? data?.stats?.totalValue ?? 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            icon: DollarSign,
            color: "bg-indigo-600",
            desc: "Setelah penyusutan garis lurus",
            subBadge: "Akuntansi"
        },
        {
            title: "Nilai Pasar (Estimasi)",
            value: `Rp ${(data?.stats?.totalMarketValue ?? 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            icon: TrendingUp,
            color: "bg-purple-600",
            desc: "Berdasarkan kondisi fisik aset",
            subBadge: "Valuasi Riil"
        }
    ];

    const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#94a3b8', '#3b82f6', '#8b5cf6'];

    // 5 MODULE STATUSES (PROPER ARRAY MAPPING TO PREVENT NaN)
    const rawProc = Array.isArray(data?.procurementData) ? data.procurementData : [];
    const procurementTotal = rawProc.reduce((sum, item) => sum + (Number(item?.value) || 0), 0);
    const procurementPending = rawProc.filter(d => ['SUBMITTED', 'VALIDATED', 'DRAFT', 'PENDING'].includes(d.name)).reduce((s, i) => s + (Number(i?.value) || 0), 0);
    const procurementApproved = rawProc.find(d => d.name === 'APPROVED')?.value || 0;
    const procurementOrdered = rawProc.filter(d => ['PROCESS', 'ORDERED'].includes(d.name)).reduce((s, i) => s + (Number(i?.value) || 0), 0);
    const procurementReceived = rawProc.find(d => d.name === 'COMPLETED')?.value || 0;
    const procurementCancelled = rawProc.find(d => d.name === 'REJECTED')?.value || 0;

    const procurementStatus = {
        total: procurementTotal,
        pending: procurementPending,
        approved: procurementApproved,
        ordered: procurementOrdered,
        received: procurementReceived,
        cancelled: procurementCancelled
    };

    const maintenanceData = Array.isArray(data?.maintenanceData) ? data.maintenanceData : [];
    const maintenanceTotal = maintenanceData.reduce((sum, item) => sum + (Number(item?.value) || 0), 0);
    const maintenancePending = maintenanceData.find(d => d.name === 'SUBMITTED')?.value || 0;
    const maintenanceActive = (maintenanceData.find(d => d.name === 'APPROVED')?.value || 0) + 
                              (maintenanceData.find(d => d.name === 'IN_PROGRESS')?.value || 0) + 
                              (maintenanceData.find(d => d.name === 'ASSIGNED')?.value || 0);
    const maintenanceCompleted = maintenanceData.find(d => d.name === 'COMPLETED')?.value || 0;
    const maintenanceRejected = maintenanceData.find(d => d.name === 'REJECTED')?.value || 0;
    const maintenancePercent = maintenanceTotal > 0 ? Math.round((maintenanceCompleted / maintenanceTotal) * 100) : 0;

    const rawMove = Array.isArray(data?.movementData) ? data.movementData : [];
    const movementTotal = rawMove.reduce((sum, item) => sum + (Number(item?.value) || 0), 0);
    const movementPending = rawMove.find(d => d.name === 'PENDING')?.value || 0;
    const movementApproved = rawMove.find(d => d.name === 'APPROVED')?.value || 0;
    const movementCompleted = rawMove.find(d => d.name === 'COMPLETED')?.value || 0;
    const movementRejected = rawMove.find(d => d.name === 'REJECTED')?.value || 0;

    const movementStatus = {
        total: movementTotal,
        pending: movementPending,
        approved: movementApproved,
        completed: movementCompleted,
        rejected: movementRejected
    };

    const rawLoan = Array.isArray(data?.loanData) ? data.loanData : [];
    const loanTotal = rawLoan.reduce((sum, item) => sum + (Number(item?.value) || 0), 0);
    const loanPending = rawLoan.find(d => d.name === 'PENDING')?.value || 0;
    const loanApproved = rawLoan.find(d => d.name === 'APPROVED')?.value || 0;
    const loanBorrowed = rawLoan.find(d => d.name === 'BORROWED')?.value || 0;
    const loanReturned = rawLoan.find(d => d.name === 'RETURNED')?.value || 0;
    const loanRejected = rawLoan.find(d => d.name === 'REJECTED')?.value || 0;
    const loanRatio = loanTotal > 0 ? Math.round((loanReturned / loanTotal) * 100) : 100;

    const loanStatus = {
        total: loanTotal,
        pending: loanPending,
        approved: loanApproved,
        borrowed: loanBorrowed,
        returned: loanReturned,
        rejected: loanRejected,
        ratio: loanRatio
    };

    const rawDisp = Array.isArray(data?.disposalData) ? data.disposalData : [];
    const disposalTotal = rawDisp.reduce((sum, item) => sum + (Number(item?.value) || 0), 0);
    const disposalProposed = (rawDisp.find(d => d.name === 'PENDING')?.value || 0) + (rawDisp.find(d => d.name === 'PROPOSED')?.value || 0);
    const disposalApproved = rawDisp.find(d => d.name === 'APPROVED')?.value || 0;
    const disposalCompleted = rawDisp.find(d => d.name === 'COMPLETED')?.value || 0;
    const disposalRejected = rawDisp.find(d => d.name === 'REJECTED')?.value || 0;

    const disposalStatus = {
        total: disposalTotal,
        proposed: disposalProposed,
        approved: disposalApproved,
        completed: disposalCompleted,
        rejected: disposalRejected
    };

    // --- PDF EXPORT (STRICTLY NO PRICES / QUANTITY ONLY) ---
    const handleExportPDF = async () => {
        if (!data) return;
        setExporting(true);
        try {
            const jsPDF = await loadJsPDF();
            const doc = new jsPDF('landscape', 'mm', 'a4');
            const pageW = doc.internal.pageSize.getWidth();
            const pageH = doc.internal.pageSize.getHeight();
            const now = new Date();
            const unitLabel = filterUnit !== 'all' ? (data?.units?.find(u => u.id === parseInt(filterUnit))?.name || 'Unit Spesifik') : 'Seluruh Satuan Kerja / Unit';

            // KOP SURAT
            doc.setFontSize(16);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text('BIDANG SARANA - YAYASAN DAR EL-IMAN', pageW / 2, 16, { align: 'center' });
            
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text('LAPORAN RINGKASAN EKSEKUTIF ASET & STATUS OPERASIONAL', pageW / 2, 23, { align: 'center' });
            
            doc.setFontSize(9);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(100, 116, 139);
            doc.text(`Lingkup: ${unitLabel}  |  Tanggal Cetak: ${now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, pageW / 2, 29, { align: 'center' });
            doc.setDrawColor(203, 213, 225);
            doc.setLineWidth(0.5);
            doc.line(14, 32, pageW - 14, 32);

            // TABEL 1: RINGKASAN KUANTITAS & KONDISI FISIK (NO PRICES)
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text('I. Rekapitulasi Kuantitas & Kondisi Fisik Aset Terdaftar', 14, 40);
            doc.autoTable({
                startY: 43,
                head: [['Total Fisik Aset', 'Kondisi BAIK', 'RUSAK RINGAN', 'RUSAK BERAT', 'Habis Masa Manfaat']],
                body: [[
                    `${(data.stats.totalAssets || 0).toLocaleString('id-ID')} Unit`,
                    `${(data.stats.goodAssets || 0).toLocaleString('id-ID')} Unit`,
                    `${(data.stats.lightDamagedAssets || 0).toLocaleString('id-ID')} Unit`,
                    `${(data.stats.heavyDamagedAssets || 0).toLocaleString('id-ID')} Unit`,
                    `${(data.stats.expiredAssets || 0).toLocaleString('id-ID')} Unit`
                ]],
                theme: 'grid',
                headStyles: { fillColor: [59, 130, 246], fontSize: 8.5, fontStyle: 'bold', halign: 'center' },
                bodyStyles: { fontSize: 9, fontStyle: 'bold', halign: 'center' },
                margin: { left: 14, right: 14 }
            });

            // TABEL 2: STATUS 5 MODUL OPERASIONAL (NO PRICES)
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text('II. Monitoring Status Alur Kerja 5 Modul Operasional Sarpras', 14, doc.lastAutoTable.finalY + 9);
            doc.autoTable({
                startY: doc.lastAutoTable.finalY + 12,
                head: [['Modul Operasional', 'Total Sesi / Tiket', 'Status Menunggu / Antri', 'Status Pengerjaan / Aktif', 'Status Selesai / Kembali', 'Status Ditolak']],
                body: [
                    [
                        'Pengadaan (Procurement)',
                        `${procurementStatus.total} Pengajuan`,
                        `${procurementStatus.pending} Pending`,
                        `${procurementStatus.approved + procurementStatus.ordered} Disetujui/Dipesan`,
                        `${procurementStatus.received} Diterima`,
                        `${procurementStatus.cancelled} Dibatalkan`
                    ],
                    [
                        'Pemeliharaan (Maintenance)',
                        `${maintenanceTotal} Tiket`,
                        `${maintenancePending} Diajukan`,
                        `${maintenanceActive} Proses`,
                        `${maintenanceCompleted} Selesai (${maintenancePercent}%)`,
                        `${maintenanceRejected} Ditolak`
                    ],
                    [
                        'Mutasi / Perpindahan Aset',
                        `${movementStatus.total} Transaksi`,
                        `${movementStatus.pending} Menunggu`,
                        `${movementStatus.approved} Disetujui`,
                        `${movementStatus.completed} Selesai Pindah`,
                        `${movementStatus.rejected} Ditolak`
                    ],
                    [
                        'Peminjaman Fasilitas (Loans)',
                        `${loanStatus.total} Transaksi`,
                        '-',
                        `${loanStatus.borrowed} Sedang Dipinjam`,
                        `${loanStatus.returned} Sudah Kembali`,
                        '-'
                    ],
                    [
                        'Penghapusan (Disposal)',
                        `${disposalStatus.total} Usulan`,
                        `${disposalStatus.proposed} Diajukan`,
                        `${disposalStatus.approved} Disetujui`,
                        `${disposalStatus.completed} Tuntas Lelang/Musnah`,
                        `${disposalStatus.rejected} Ditolak`
                    ]
                ],
                theme: 'striped',
                headStyles: { fillColor: [79, 70, 229], fontSize: 8, fontStyle: 'bold' },
                bodyStyles: { fontSize: 8 },
                margin: { left: 14, right: 14 }
            });

            // TABEL 3: SEBARAN ASET PER SATKER / UNIT (NO PRICES)
            if (data.unitStats?.length > 0) {
                doc.setFontSize(10);
                doc.setFont(undefined, 'bold');
                doc.setTextColor(30, 41, 59);
                doc.text('III. Rekapitulasi Sebaran Fisik Aset per Satuan Kerja / Unit', 14, doc.lastAutoTable.finalY + 9);
                doc.autoTable({
                    startY: doc.lastAutoTable.finalY + 12,
                    head: [['No', 'Satuan Kerja / Unit', 'Kode', 'Total Item', 'Kondisi Baik', 'Rusak Ringan/Berat']],
                    body: data.unitStats.map((u, idx) => [
                        idx + 1,
                        u.name,
                        u.code || '-',
                        `${u.assetCount.toLocaleString('id-ID')} unit`,
                        `${((u.assetCount || 0) - (u.damagedCount || 0)).toLocaleString('id-ID')} unit`,
                        `${(u.damagedCount || 0).toLocaleString('id-ID')} unit`
                    ]),
                    theme: 'striped',
                    headStyles: { fillColor: [15, 118, 110], fontSize: 8, fontStyle: 'bold' },
                    bodyStyles: { fontSize: 7.5 },
                    margin: { left: 14, right: 14 }
                });
            }

            // FOOTER & PENOMORAN HALAMAN
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(7.5);
                doc.setTextColor(148, 163, 184);
                doc.text(`Halaman ${i} dari ${pageCount}  |  Sistem Informasi Manajemen Aset Yayasan Dar El-Iman (Laporan Kuantitas Fisik Tanpa Harga)`, pageW / 2, pageH - 8, { align: 'center' });
            }

            doc.save(`Laporan_Dashboard_Kuantitas_${unitLabel.replace(/[/ ]/g, '_')}_${now.toISOString().slice(0, 10)}.pdf`);
        } catch (err) {
            console.error('PDF Export Error:', err);
            alert('Gagal mengekspor PDF: ' + err.message);
        } finally {
            setExporting(false);
        }
    };

    const isSarana = currentUser.position === 'Kepala Bidang Sarana';

    const handleScanNFC = async () => {
        if (!('NDEFReader' in window)) {
            alert('Peramban Anda tidak mendukung Web NFC. Gunakan Google Chrome di Android.');
            return;
        }
        try {
            const ndef = new window.NDEFReader();
            await ndef.scan();
            alert('Dekatkan HP Anda ke Stiker NFC...');

            ndef.onreading = event => {
                const message = event.message;
                for (const record of message.records) {
                    if (record.recordType === "text") {
                        const textDecoder = new TextDecoder(record.encoding);
                        const text = textDecoder.decode(record.data);
                        if (text.startsWith('manajemenaset-id:')) {
                            const assetId = text.split(':')[1];
                            window.location.href = `/aset/${assetId}`;
                        } else {
                            alert('NFC Tag tidak dikenali oleh sistem ini.');
                        }
                    }
                }
            };
        } catch (error) {
            console.error(error);
            alert('Gagal mengaktifkan pemindai NFC: ' + error.message);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                        Dashboard Manajemen Aset
                    </h1>
                    <p className="text-slate-500 text-xs font-medium mt-0.5">
                        {activeTab === 'weekly'
                            ? 'Laporan pergerakan harian, mingguan, bulanan, dan audit fisik aset (Fokus kuantitas tanpa harga)'
                            : (filterUnit !== 'all'
                                ? `Menampilkan data akumulatif unit: ${data?.units?.find(u => u.id === parseInt(filterUnit))?.name || 'Unit Terpilih'}`
                                : 'Ringkasan komprehensif aset, kondisi fisik, nilai buku/pasar, dan 5 modul operasional')}
                    </p>
                </div>

                {activeTab === 'overview' && (
                    <div className="flex flex-wrap items-center gap-3">
                        {canFilterUnit && (
                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                                <span className="text-xs font-bold text-slate-400 uppercase">Unit:</span>
                                <select
                                    value={filterUnit}
                                    onChange={(e) => setFilterUnit(e.target.value)}
                                    className="text-xs border-none bg-transparent focus:ring-0 text-slate-700 font-bold cursor-pointer outline-none"
                                >
                                    <option value="all">Semua Unit</option>
                                    {data?.units?.map(u => (
                                        <option key={u.id} value={u.id}>{u.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {isSarana && (
                            <button
                                onClick={handleScanNFC}
                                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-indigo-200 transition-all"
                            >
                                Scan NFC Aset
                            </button>
                        )}
                        {isKepalaBidangSarana && (
                            <button
                                onClick={handleToggleAiAnalysis}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md",
                                    showAiAnalysis
                                        ? "bg-slate-900 text-indigo-300 border border-indigo-500/40 shadow-indigo-200"
                                        : "bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 text-white shadow-indigo-200"
                                )}
                                title="Buka / Tutup Analisis Eksekutif & Rekomendasi Cerdas AI"
                            >
                                <Sparkles size={15} className={cn("text-amber-300", aiLoading && "animate-spin")} />
                                {showAiAnalysis ? 'Tutup Analisis AI' : 'Fitur Analisis AI'}
                            </button>
                        )}
                        <button
                            onClick={handleExportPDF}
                            disabled={exporting}
                            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-slate-200 transition-all disabled:opacity-50"
                            title="Unduh Rekap Laporan PDF (Fokus Kuantitas Tanpa Harga)"
                        >
                            {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                            {exporting ? 'Mengekspor...' : 'Export PDF'}
                        </button>
                    </div>
                )}
            </div>

            {/* TAB SWITCHER */}
            {canAccessWeeklyReport && (
                <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl w-fit border border-slate-200 shadow-inner print:hidden">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={cn(
                            "flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all",
                            activeTab === 'overview'
                                ? "bg-white text-slate-800 shadow-sm"
                                : "text-slate-500 hover:text-slate-800"
                        )}
                    >
                        <Box size={16} className={activeTab === 'overview' ? "text-indigo-600" : ""} />
                        Ikhtisar & Valuasi Kumulatif
                    </button>
                    <button
                        onClick={() => setActiveTab('weekly')}
                        className={cn(
                            "flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all relative",
                            activeTab === 'weekly'
                                ? "bg-white text-indigo-700 shadow-sm"
                                : "text-slate-500 hover:text-slate-800"
                        )}
                    >
                        <CalendarRange size={16} className={activeTab === 'weekly' ? "text-indigo-600" : ""} />
                        Laporan Operasional & Cetak Berkala
                        <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-700 rounded-full">
                            Kuantitas
                        </span>
                    </button>
                </div>
            )}

            {/* TAB CONTENT */}
            {canAccessWeeklyReport && activeTab === 'weekly' ? (
                <WeeklyAssetReport currentUser={currentUser} />
            ) : (
                <>
                    {/* 1. TOP 6 CORE METRICS (TOTAL ASET, BAIK, RUSAK RINGAN, RUSAK BERAT, NILAI BUKU, NILAI PASAR) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                        {stats.map((s, i) => <StatCard key={i} {...s} />)}
                    </div>

                    {/* 2. AI EXECUTIVE SUMMARY (KHUSUS KEPALA BIDANG SARANA & ON-CLICK TRIGGER) */}
                    {isKepalaBidangSarana && !showAiAnalysis && (
                        <div className="bg-gradient-to-r from-indigo-50 via-white to-indigo-50/50 border border-indigo-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm hover:border-indigo-300 transition-all">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
                                    <Sparkles size={20} className="text-amber-300" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h4 className="text-sm font-black text-slate-800 tracking-tight">
                                            Analisis Eksekutif & Rekomendasi Cerdas AI
                                        </h4>
                                        <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
                                            Khusus Kepala Bidang Sarana
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Klik tombol untuk mensintesis data aset terkini, kalkulasi indeks kesehatan, dan rekomendasi strategis.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleToggleAiAnalysis}
                                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-200 transition-all shrink-0"
                            >
                                <Sparkles size={14} className="text-amber-300" />
                                Buka Analisis AI
                            </button>
                        </div>
                    )}

                    {isKepalaBidangSarana && showAiAnalysis && (
                        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                            <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
                            
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/10 relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-500/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                                        <Sparkles size={20} className={cn(aiLoading && "animate-spin")} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-base font-black tracking-tight">Analisis Eksekutif & Rekomendasi Cerdas AI</h3>
                                            <span className={cn(
                                                "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full",
                                                aiSummary?.source === 'gemini_ai'
                                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                                    : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                            )}>
                                                {aiSummary?.source === 'gemini_ai' ? 'Powered by Gemini AI' : 'Mode Aturan Logika'}
                                            </span>
                                            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                                                Khusus Kepala Bidang Sarana
                                            </span>
                                        </div>
                                        <p className="text-xs text-indigo-200/70 mt-0.5">
                                            Sintesis otomatis kesehatan aset, efisiensi alur operasional, dan saran mitigasi risiko
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    {aiSummary?.healthScore !== undefined && (
                                        <div className="flex items-center gap-2 bg-white/10 px-3.5 py-1.5 rounded-xl border border-white/10">
                                            <ShieldCheck size={16} className={cn(
                                                aiSummary.healthScore >= 80 ? "text-emerald-400" :
                                                aiSummary.healthScore >= 60 ? "text-amber-400" : "text-rose-400"
                                            )} />
                                            <div className="text-right">
                                                <div className="text-[10px] uppercase font-bold text-indigo-200">Indeks Kesehatan</div>
                                                <div className="text-sm font-black text-white">{aiSummary.healthScore}%</div>
                                            </div>
                                        </div>
                                    )}
                                    <button
                                        onClick={fetchAiSummary}
                                        disabled={aiLoading}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all disabled:opacity-50"
                                        title="Analisis Ulang dengan AI"
                                    >
                                        <RefreshCw size={13} className={cn(aiLoading && "animate-spin")} />
                                        {aiLoading ? 'Menganalisis...' : 'Segarkan AI'}
                                    </button>
                                    <button
                                        onClick={() => setShowAiAnalysis(false)}
                                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-rose-500/30 border border-white/20 text-white hover:text-rose-200 hover:border-rose-400/30 transition-all"
                                        title="Tutup Panel Analisis AI"
                                    >
                                        <X size={13} />
                                        <span>Tutup</span>
                                    </button>
                                </div>
                            </div>

                            {/* AI CONTENT AREA */}
                            <div className="pt-5 relative z-10">
                                {aiLoading && !aiSummary ? (
                                    <div className="flex items-center justify-center py-8 gap-3 text-indigo-200 text-xs font-semibold">
                                        <Loader2 size={18} className="animate-spin text-indigo-400" />
                                        <span>Sedang mensintesis data aset & menghasilkan rekomendasi strategis...</span>
                                    </div>
                                ) : aiError && !aiSummary ? (
                                    <div className="p-4 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-200 text-xs flex items-center justify-between gap-3">
                                        <span>{aiError}</span>
                                        <button onClick={fetchAiSummary} className="underline font-bold text-white hover:text-rose-100">Coba Lagi</button>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {/* Executive summary paragraph */}
                                        <p className="text-xs text-indigo-100 leading-relaxed bg-white/5 p-4 rounded-2xl border border-white/5">
                                            {aiSummary?.executiveSummary || 'Sistem manajemen aset beroperasi stabil dengan pemantauan terpadu.'}
                                        </p>

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            {/* Key Insights */}
                                            <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-2">
                                                <h4 className="text-[11px] font-black uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                                                    <Activity size={14} /> Temuan Utama (Key Insights)
                                                </h4>
                                                <ul className="space-y-1.5">
                                                    {(aiSummary?.keyInsights || []).map((insight, idx) => (
                                                        <li key={idx} className="text-xs text-slate-200 flex items-start gap-2">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0"></span>
                                                            <span>{insight}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>

                                            {/* Strategic Recommendations */}
                                            <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-2">
                                                <h4 className="text-[11px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                                                    <Lightbulb size={14} /> Rekomendasi Tindakan (Action Items)
                                                </h4>
                                                <ul className="space-y-1.5">
                                                    {(aiSummary?.recommendations || []).map((rec, idx) => (
                                                        <li key={idx} className="text-xs text-slate-200 flex items-start gap-2">
                                                            <Check size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                                                            <span>{rec}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 3. MONITORING STATUS ALUR KERJA (5 MODUL OPERASIONAL) */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                                <Layers size={16} className="text-indigo-600" />
                                Monitoring Status Alur Kerja 5 Modul Sarpras
                            </h3>
                            <span className="text-xs text-slate-400 font-medium">Real-time workflow tracker</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                            {/* MODUL 1: PROCUREMENT */}
                            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                        <Layers size={16} />
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Pengadaan</span>
                                </div>
                                <div>
                                    <div className="text-xl font-black text-slate-800">{procurementStatus.total} <span className="text-xs font-semibold text-slate-400">Pengajuan</span></div>
                                    <div className="text-[11px] font-bold text-indigo-700 mt-0.5">Status Procurement</div>
                                </div>
                                <div className="space-y-1.5 pt-2 border-t border-slate-50 text-[11px]">
                                    <div className="flex justify-between text-slate-600">
                                        <span>Menunggu Approval:</span>
                                        <span className="font-bold text-amber-600">{procurementStatus.pending}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-600">
                                        <span>Disetujui / Dipesan:</span>
                                        <span className="font-bold text-blue-600">{procurementStatus.approved + procurementStatus.ordered}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-600">
                                        <span>Diterima Lengkap:</span>
                                        <span className="font-bold text-emerald-600">{procurementStatus.received}</span>
                                    </div>
                                </div>
                            </div>

                            {/* MODUL 2: MAINTENANCE */}
                            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                                        <Wrench size={16} />
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Servis</span>
                                </div>
                                <div>
                                    <div className="text-xl font-black text-slate-800">{maintenanceTotal} <span className="text-xs font-semibold text-slate-400">Tiket</span></div>
                                    <div className="text-[11px] font-bold text-amber-700 mt-0.5">Status Maintenance ({maintenancePercent}%)</div>
                                </div>
                                <div className="space-y-1.5 pt-2 border-t border-slate-50 text-[11px]">
                                    <div className="flex justify-between text-slate-600">
                                        <span>Antrian Diajukan:</span>
                                        <span className="font-bold text-slate-600">{maintenancePending}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-600">
                                        <span>Pengerjaan Aktif:</span>
                                        <span className="font-bold text-amber-600">{maintenanceActive}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-600">
                                        <span>Tuntas Selesai:</span>
                                        <span className="font-bold text-emerald-600">{maintenanceCompleted}</span>
                                    </div>
                                </div>
                            </div>

                            {/* MODUL 3: MUTASI */}
                            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                        <ArrowLeftRight size={16} />
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Relokasi</span>
                                </div>
                                <div>
                                    <div className="text-xl font-black text-slate-800">{movementStatus.total} <span className="text-xs font-semibold text-slate-400">Transaksi</span></div>
                                    <div className="text-[11px] font-bold text-blue-700 mt-0.5">Status Mutasi Aset</div>
                                </div>
                                <div className="space-y-1.5 pt-2 border-t border-slate-50 text-[11px]">
                                    <div className="flex justify-between text-slate-600">
                                        <span>Menunggu Persetujuan:</span>
                                        <span className="font-bold text-amber-600">{movementStatus.pending}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-600">
                                        <span>Disetujui / Selesai:</span>
                                        <span className="font-bold text-emerald-600">{movementStatus.approved + movementStatus.completed}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-600">
                                        <span>Ditolak / Batal:</span>
                                        <span className="font-bold text-rose-600">{movementStatus.rejected}</span>
                                    </div>
                                </div>
                            </div>

                            {/* MODUL 4: PEMINJAMAN */}
                            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                                        <Handshake size={16} />
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Logistik</span>
                                </div>
                                <div>
                                    <div className="text-xl font-black text-slate-800">{loanStatus.total} <span className="text-xs font-semibold text-slate-400">Sesi</span></div>
                                    <div className="text-[11px] font-bold text-violet-700 mt-0.5">Status Peminjaman</div>
                                </div>
                                <div className="space-y-1.5 pt-2 border-t border-slate-50 text-[11px]">
                                    <div className="flex justify-between text-slate-600">
                                        <span>Sedang Dipinjam:</span>
                                        <span className="font-bold text-amber-600">{loanStatus.borrowed} aktif</span>
                                    </div>
                                    <div className="flex justify-between text-slate-600">
                                        <span>Sudah Dikembalikan:</span>
                                        <span className="font-bold text-emerald-600">{loanStatus.returned} kembali</span>
                                    </div>
                                    <div className="flex justify-between text-slate-600">
                                        <span>Rasio Kembali:</span>
                                        <span className="font-bold text-indigo-600">
                                            {loanStatus.ratio}%
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* MODUL 5: PENGHAPUSAN */}
                            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                                        <Trash2 size={16} />
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Disposal</span>
                                </div>
                                <div>
                                    <div className="text-xl font-black text-slate-800">{disposalStatus.total} <span className="text-xs font-semibold text-slate-400">Usulan</span></div>
                                    <div className="text-[11px] font-bold text-rose-700 mt-0.5">Status Penghapusan</div>
                                </div>
                                <div className="space-y-1.5 pt-2 border-t border-slate-50 text-[11px]">
                                    <div className="flex justify-between text-slate-600">
                                        <span>Diusulkan (Review):</span>
                                        <span className="font-bold text-amber-600">{disposalStatus.proposed}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-600">
                                        <span>Disetujui Eksekusi:</span>
                                        <span className="font-bold text-emerald-600">{disposalStatus.approved + disposalStatus.completed}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-600">
                                        <span>Ditolak / Dipertahankan:</span>
                                        <span className="font-bold text-slate-500">{disposalStatus.rejected}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 4. CHARTS SECTION */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* CHART 1: KONDISI FISIK ASET SAAT INI */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <h3 className="text-base font-black text-slate-800">Distribusi Kondisi Fisik Aset</h3>
                                    <p className="text-xs text-slate-400 font-medium">Proporsi kelayakan aset operasional</p>
                                </div>
                                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                                    Total {(data?.stats?.totalAssets || 0).toLocaleString('id-ID')} Unit
                                </span>
                            </div>
                            <div className="h-64 flex justify-center items-center">
                                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                    <PieChart>
                                        <Pie
                                            data={data?.conditionData || []}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={65}
                                            outerRadius={95}
                                            paddingAngle={4}
                                            dataKey="value"
                                        >
                                            {(data?.conditionData || []).map((entry, index) => {
                                                const conditionColors = {
                                                    'Baik': '#10b981',
                                                    'Rusak Ringan': '#f59e0b',
                                                    'Rusak Berat': '#ef4444',
                                                    'Dihapuskan': '#94a3b8'
                                                };
                                                return <Cell key={`cell-${index}`} fill={conditionColors[entry.name] || COLORS[index % COLORS.length]} />;
                                            })}
                                        </Pie>
                                        <Tooltip
                                            formatter={(val) => `${val.toLocaleString('id-ID')} Unit`}
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-100">
                                {(data?.conditionData || []).map((entry, idx) => {
                                    const dotColors = {
                                        'Baik': 'bg-emerald-500',
                                        'Rusak Ringan': 'bg-amber-500',
                                        'Rusak Berat': 'bg-rose-500',
                                        'Dihapuskan': 'bg-slate-400'
                                    };
                                    return (
                                        <div key={idx} className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-50">
                                            <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", dotColors[entry.name] || 'bg-blue-500')}></div>
                                            <div className="truncate">
                                                <div className="text-[10px] font-bold text-slate-500 uppercase">{entry.name}</div>
                                                <div className="text-xs font-black text-slate-800">{entry.value} unit</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* CHART 2: PENGADAAN PER KATEGORI (BAR CHART) */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <h3 className="text-base font-black text-slate-800">Analisa Pengadaan Aset</h3>
                                    <p className="text-xs text-slate-400 font-medium">Berdasarkan kelompok kategori barang</p>
                                </div>
                                <div className="flex bg-slate-100 p-1 rounded-xl">
                                    <button
                                        onClick={() => setChartMode('count')}
                                        className={cn(
                                            "px-3 py-1 text-[10px] font-bold rounded-lg transition-all",
                                            chartMode === 'count' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"
                                        )}
                                    >
                                        JUMLAH (UNIT)
                                    </button>
                                    <button
                                        onClick={() => setChartMode('spending')}
                                        className={cn(
                                            "px-3 py-1 text-[10px] font-bold rounded-lg transition-all",
                                            chartMode === 'spending' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"
                                        )}
                                    >
                                        NILAI (RP)
                                    </button>
                                </div>
                            </div>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                    <BarChart data={chartMode === 'count' ? data?.chartData : data?.spendingData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} dy={10} />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#64748b', fontSize: 10 }}
                                            tickFormatter={(val) => chartMode === 'spending' ? `${(val / 1000000).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}jt` : val.toLocaleString('id-ID')}
                                        />
                                        <Tooltip
                                            formatter={(val) => chartMode === 'spending' ? `Rp ${val.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `${val.toLocaleString('id-ID')} Unit`}
                                            contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                            cursor={{ fill: '#f8fafc' }}
                                        />
                                        <Bar dataKey="value" fill={chartMode === 'count' ? "#6366f1" : "#10b981"} radius={[6, 6, 0, 0]} barSize={32} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex justify-end mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
                                Mode: <span className="font-bold text-slate-700 ml-1">{chartMode === 'count' ? 'Volume Unit Barang' : 'Total Belanja / Anggaran (Rp)'}</span>
                            </div>
                        </div>

                        {/* CHART 3: STATISTIK PEMELIHARAAN (LEBAR PENUH) */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                <div>
                                    <h3 className="text-base font-black text-slate-800">Statistik Status Pemeliharaan Sarana</h3>
                                    <p className="text-xs text-slate-400 font-medium">Monitoring tiket perbaikan, teknisi, dan rasio penyelesaian</p>
                                </div>
                                <div className="flex items-center gap-3 bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-100">
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Ketercapaian Servis</p>
                                        <p className="text-xl font-black text-emerald-700">{maintenancePercent}%</p>
                                    </div>
                                    <div className="w-10 h-10 rounded-full border-4 border-emerald-100 border-t-emerald-500 flex items-center justify-center">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                                <div className="md:col-span-1 h-64">
                                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                        <PieChart>
                                            <Pie
                                                data={data?.maintenanceData || []}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={85}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {(data?.maintenanceData || []).map((entry, index) => {
                                                    const colorMap = {
                                                        'SUBMITTED': '#94a3b8',
                                                        'APPROVED': '#38bdf8',
                                                        'VALIDATED': '#818cf8',
                                                        'ASSIGNED': '#fbbf24',
                                                        'IN_PROGRESS': '#f59e0b',
                                                        'COMPLETED': '#10b981',
                                                        'REJECTED': '#ef4444'
                                                    };
                                                    return <Cell key={`cell-${index}`} fill={colorMap[entry.name] || COLORS[index % COLORS.length]} />;
                                                })}
                                            </Pie>
                                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {(data?.maintenanceData || []).map((item, idx) => {
                                        const colorMap = {
                                            'SUBMITTED': 'bg-slate-50 text-slate-700 border-slate-200',
                                            'APPROVED': 'bg-sky-50 text-sky-700 border-sky-200',
                                            'VALIDATED': 'bg-indigo-50 text-indigo-700 border-indigo-200',
                                            'ASSIGNED': 'bg-amber-50 text-amber-700 border-amber-200',
                                            'IN_PROGRESS': 'bg-orange-50 text-orange-700 border-orange-200',
                                            'COMPLETED': 'bg-emerald-50 text-emerald-700 border-emerald-200',
                                            'REJECTED': 'bg-rose-50 text-rose-700 border-rose-200'
                                        };
                                        return (
                                            <div key={idx} className={cn("p-4 rounded-xl border transition-all", colorMap[item.name] || 'bg-slate-50')}>
                                                <div className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">{item.name}</div>
                                                <div className="text-xl font-black">{item.value.toLocaleString('id-ID')}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 5. SEBARAN ASET PER UNIT TABLE */}
                    {canFilterUnit && filterUnit === 'all' && data?.unitStats?.length > 0 && (
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden animate-in zoom-in-95 duration-300">
                            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white">
                                <div>
                                    <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                                        <Building2 className="text-indigo-600" size={18} />
                                        Sebaran Aset per Satuan Kerja / Unit
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-0.5">Inventarisasi fisik dan kondisi di setiap unit operasional</p>
                                </div>
                                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                                    {data.unitStats.length} Unit Kerja
                                </span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider">
                                        <tr>
                                            <th className="px-5 py-3.5">Unit / Satker</th>
                                            <th className="px-5 py-3.5 text-center">Total Fisik</th>
                                            <th className="px-5 py-3.5 text-center">Kondisi Baik</th>
                                            <th className="px-5 py-3.5 text-center">Rusak Ringan/Berat</th>
                                            <th className="px-5 py-3.5 text-right">Nilai Buku (Terkini)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {data.unitStats.map((unit) => {
                                            const goodCount = Math.max(0, (unit.assetCount || 0) - (unit.damagedCount || 0));
                                            return (
                                                <tr key={unit.id} className="hover:bg-slate-50/60 transition-colors">
                                                    <td className="px-5 py-3.5">
                                                        <div className="font-bold text-slate-800 text-sm">{unit.name}</div>
                                                        <div className="text-[10px] text-slate-400 font-mono font-medium">{unit.code || '-'}</div>
                                                    </td>
                                                    <td className="px-5 py-3.5 text-center">
                                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black bg-blue-50 text-blue-700">
                                                            {unit.assetCount.toLocaleString('id-ID')} unit
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3.5 text-center">
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700">
                                                            {goodCount.toLocaleString('id-ID')} unit
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3.5 text-center">
                                                        <span className={cn(
                                                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold",
                                                            unit.damagedCount > 0 ? "bg-rose-50 text-rose-700 font-black" : "bg-slate-100 text-slate-400"
                                                        )}>
                                                            {unit.damagedCount.toLocaleString('id-ID')} unit
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3.5 text-right font-bold text-slate-700">
                                                        Rp {unit.totalValue.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default Dashboard;
