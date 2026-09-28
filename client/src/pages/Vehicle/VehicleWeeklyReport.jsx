import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    Car, Calendar, Gauge, CheckCircle2, AlertCircle, ClipboardList, 
    ArrowLeft, Download, Filter, Loader2, Sparkles, TrendingUp, ShieldCheck, Wrench, FileText
} from 'lucide-react';
import api from '../../lib/axios';

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

const VehicleWeeklyReport = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [vehicle, setVehicle] = useState(null);
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [exporting, setExporting] = useState(false);

    // Filter states
    const [filterPreset, setFilterPreset] = useState('all'); // 'all' | 'this_month' | 'last_month' | '30d' | 'custom'
    const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });

    const [form, setForm] = useState({
        weekStartDate: '',
        weekEndDate: '',
        startOdometer: '',
        endOdometer: '',
        conditionEngine: 'BAIK',
        conditionBody: 'BAIK',
        conditionInterior: 'BAIK',
        isClean: true,
        notes: ''
    });

    useEffect(() => {
        fetchVehicleAndReports();
    }, [id]);

    const fetchVehicleAndReports = async () => {
        try {
            setLoading(true);
            const [vRes, rRes, draftRes] = await Promise.all([
                api.get(`/vehicles/${id}`),
                api.get(`/vehicles/${id}/reports/weekly`),
                api.get(`/vehicles/${id}/reports/weekly/draft`)
            ]);
            setVehicle(vRes.data);
            setReports(rRes.data || []);

            // Pre-fill dates and odometer from draft
            setForm(prev => ({
                ...prev,
                startOdometer: draftRes.data.startOdometer,
                endOdometer: draftRes.data.endOdometer,
                weekStartDate: draftRes.data.weekStartDate,
                weekEndDate: draftRes.data.weekEndDate
            }));
        } catch (error) {
            console.error('Failed to fetch data:', error);
            alert('Gagal mengambil data kendaraan');
        } finally {
            setLoading(false);
        }
    };

    const handleApplyPreset = (preset) => {
        setFilterPreset(preset);
        const now = new Date();
        const formatDate = (d) => d.toISOString().split('T')[0];

        if (preset === 'all') {
            setDateRange({ startDate: '', endDate: '' });
        } else if (preset === 'this_month') {
            const s = new Date(now.getFullYear(), now.getMonth(), 1);
            const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            setDateRange({ startDate: formatDate(s), endDate: formatDate(e) });
        } else if (preset === 'last_month') {
            const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const e = new Date(now.getFullYear(), now.getMonth(), 0);
            setDateRange({ startDate: formatDate(s), endDate: formatDate(e) });
        } else if (preset === '30d') {
            const s = new Date();
            s.setDate(s.getDate() - 30);
            setDateRange({ startDate: formatDate(s), endDate: formatDate(now) });
        }
    };

    // Filter reports according to date range
    const filteredReports = reports.filter(r => {
        if (!dateRange.startDate && !dateRange.endDate) return true;
        const start = dateRange.startDate ? new Date(dateRange.startDate) : null;
        if (start) start.setHours(0, 0, 0, 0);
        const end = dateRange.endDate ? new Date(dateRange.endDate) : null;
        if (end) end.setHours(23, 59, 59, 999);

        const rStart = new Date(r.weekStartDate);
        const rEnd = new Date(r.weekEndDate || r.weekStartDate);

        if (start && rEnd < start) return false;
        if (end && rStart > end) return false;
        return true;
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.weekStartDate || !form.weekEndDate || form.endOdometer === '') {
            return alert('Harap isi semua field utama');
        }

        try {
            setSubmitting(true);
            await api.post('/vehicles/reports/weekly', {
                ...form,
                vehicleId: id
            });
            alert('Laporan mingguan berhasil disimpan');
            fetchVehicleAndReports();
            setForm({
                ...form,
                notes: ''
            });
        } catch (error) {
            alert(error.response?.data?.error || 'Gagal menyimpan laporan');
        } finally {
            setSubmitting(false);
        }
    };

    // --- PDF EXPORT FUNCTION WITH COMPREHENSIVE VEHICLE MANAGEMENT ANALYSIS ---
    const handleExportPDF = async () => {
        if (filteredReports.length === 0) {
            return alert('Tidak ada data laporan mingguan dalam rentang tanggal yang dipilih untuk diunduh.');
        }

        setExporting(true);
        try {
            const jsPDF = await loadJsPDF();
            const doc = new jsPDF('portrait', 'mm', 'a4');
            const pageW = doc.internal.pageSize.getWidth();
            const pageH = doc.internal.pageSize.getHeight();
            const now = new Date();

            let periodLabel = 'Semua Periode Laporan';
            if (dateRange.startDate && dateRange.endDate) {
                const sStr = new Date(dateRange.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
                const eStr = new Date(dateRange.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
                periodLabel = `${sStr} s/d ${eStr}`;
            } else if (dateRange.startDate) {
                periodLabel = `Mulai ${new Date(dateRange.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
            } else if (dateRange.endDate) {
                periodLabel = `Sampai ${new Date(dateRange.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
            }

            const printDateStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

            // 1. KOP SURAT RESMI BIDANG SARANA
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text('YAYASAN DAR EL-IMAN PADANG', pageW / 2, 14, { align: 'center' });

            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(79, 70, 229);
            doc.text('BIDANG SARANA & PRASARANA (SARPRAS)', pageW / 2, 19, { align: 'center' });

            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(15, 23, 42);
            doc.text('LAPORAN PENGAWASAN MINGGUAN KENDARAAN OPERASIONAL', pageW / 2, 25, { align: 'center' });

            doc.setFontSize(8);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(100, 116, 139);
            doc.text(`Periode Pemeriksaan: ${periodLabel}   |   Dicetak: ${printDateStr}`, pageW / 2, 30, { align: 'center' });

            doc.setDrawColor(203, 213, 225);
            doc.setLineWidth(0.5);
            doc.line(14, 33, pageW - 14, 33);

            // 2. METADATA IDENTITAS KENDARAAN
            doc.autoTable({
                startY: 36,
                head: [['IDENTITAS KENDARAAN OPERASIONAL', 'STATUS & ODOMETER TERKINI']],
                body: [
                    [
                        `Nama Unit : ${vehicle.name || '-'}\nNomor Plat : ${vehicle.plateNumber || '-'}\nMerk/Tipe  : ${vehicle.brand || ''} ${vehicle.model || ''} (${vehicle.type || 'KENDARAAN'})\nBahan Bakar: ${vehicle.fuelType || 'BENSIN/SOLAR'}`,
                        `Status Operasional : ${vehicle.status === 'ACTIVE' ? 'AKTIF BEROPERASI' : 'NON-AKTIF'}\nOdometer Terkini  : ${vehicle.odometer ? vehicle.odometer.toLocaleString('id-ID') + ' KM' : '-'}\nKapasitas Penumpang: ${vehicle.capacity ? vehicle.capacity + ' Orang' : '-'}\nTotal Laporan Masuk : ${filteredReports.length} Minggu Terdata`
                    ]
                ],
                theme: 'grid',
                headStyles: { fillColor: [51, 65, 85], fontSize: 8, fontStyle: 'bold' },
                bodyStyles: { fontSize: 8, textColor: [30, 41, 59], cellPadding: 3 },
                margin: { left: 14, right: 14 }
            });

            // 3. TABEL 1: DATA RINCIAN LAPORAN MINGGUAN SESUAI RENTANG TANGGAL
            let currentY = doc.lastAutoTable.finalY + 8;
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text('1. DATA RINCIAN LAPORAN MINGGUAN (Rentang Tanggal)', 14, currentY);

            const sortedReports = [...filteredReports].sort((a, b) => new Date(a.weekStartDate) - new Date(b.weekStartDate));
            const reportRows = sortedReports.map((r, i) => {
                const sDate = new Date(r.weekStartDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
                const eDate = new Date(r.weekEndDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
                const kmDelta = Math.max(0, (r.endOdometer || 0) - (r.startOdometer || 0));

                return [
                    i + 1,
                    `${sDate} - ${eDate}`,
                    (r.startOdometer || 0).toLocaleString('id-ID'),
                    (r.endOdometer || 0).toLocaleString('id-ID'),
                    `+${kmDelta.toLocaleString('id-ID')} KM`,
                    r.conditionEngine || 'BAIK',
                    r.conditionBody || 'BAIK',
                    r.isClean ? 'Bersih' : 'Kurang Bersih',
                    `${r.user?.name || 'PIC'}${r.notes ? ` : "${r.notes}"` : ''}`
                ];
            });

            const totalPeriodKm = sortedReports.reduce((acc, r) => acc + Math.max(0, (r.endOdometer || 0) - (r.startOdometer || 0)), 0);
            const avgWeeklyKm = sortedReports.length > 0 ? Math.round(totalPeriodKm / sortedReports.length) : 0;

            doc.autoTable({
                startY: currentY + 3,
                head: [['#', 'Periode (Sab-Jum)', 'KM Awal', 'KM Akhir', 'Jarak (+KM)', 'Mesin', 'Body', 'Kebersihan', 'Pelapor & Catatan']],
                body: reportRows,
                foot: [[
                    '', 'TOTAL TEMPUH PERIODE', '', '',
                    `+${totalPeriodKm.toLocaleString('id-ID')} KM`,
                    `Rata-rata: ${avgWeeklyKm.toLocaleString('id-ID')} KM / Minggu`,
                    '', '', ''
                ]],
                theme: 'striped',
                headStyles: { fillColor: [79, 70, 229], fontSize: 7.5, fontStyle: 'bold' },
                footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontSize: 7.5, fontStyle: 'bold' },
                bodyStyles: { fontSize: 7 },
                margin: { left: 14, right: 14 }
            });

            // 4. BAGIAN 2: ANALISIS & EVALUASI MANAJEMEN KENDARAAN (RENTANG TANGGAL)
            // If vertical space is tight, add a new page
            if (doc.lastAutoTable.finalY > pageH - 95) {
                doc.addPage();
                currentY = 20;
            } else {
                currentY = doc.lastAutoTable.finalY + 9;
            }

            doc.setFontSize(10.5);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(79, 70, 229);
            doc.text('2. ANALISIS & EVALUASI MANAJEMEN KENDARAAN (Rentang Tanggal Terpilih)', 14, currentY);

            // Compute Analytical Metrics
            const cleanCount = sortedReports.filter(r => r.isClean).length;
            const cleanlinessRate = sortedReports.length > 0 ? Math.round((cleanCount / sortedReports.length) * 100) : 100;
            const engineGoodCount = sortedReports.filter(r => r.conditionEngine === 'BAIK').length;
            const engineProblemCount = sortedReports.length - engineGoodCount;
            const bodyGoodCount = sortedReports.filter(r => r.conditionBody === 'BAIK').length;
            const bodyIssueCount = sortedReports.length - bodyGoodCount;

            let intensityLabel = 'Rendah (Operasional Ringan Rutin)';
            let intensityColor = [16, 185, 129];
            if (avgWeeklyKm > 1200) {
                intensityLabel = 'Sangat Tinggi / Ekstrem (Waspada Keausan Cepat)';
                intensityColor = [220, 38, 38];
            } else if (avgWeeklyKm > 600) {
                intensityLabel = 'Tinggi (Operasional Intensif Antar Wilayah)';
                intensityColor = [234, 88, 12];
            } else if (avgWeeklyKm >= 200) {
                intensityLabel = 'Moderat / Optimal (Penggunaan Seimbang)';
                intensityColor = [59, 130, 246];
            }

            const analysisRows = [
                [
                    'A. Mobilitas & Intensitas Penggunaan Unit',
                    `Total akumulasi jarak tempuh dalam periode: ${totalPeriodKm.toLocaleString('id-ID')} KM selama ${sortedReports.length} minggu laporan.\n` +
                    `Rata-rata jarak tempuh mingguan: ${avgWeeklyKm.toLocaleString('id-ID')} KM / minggu.\n` +
                    `Status Beban Operasional: ${intensityLabel}.\n` +
                    `Evaluasi: ${avgWeeklyKm > 800 ? 'Kendaraan memiliki intensitas operasional sangat tinggi; disarankan melakukan pengecekan pelumas dan tekanan ban lebih sering.' : 'Tingkat penggunaan berada dalam ambang batas wajar dan optimal untuk operasional dinas.'}`
                ],
                [
                    'B. Evaluasi Teknis Kondisi Mesin & Fisik Kendaraan',
                    `Kondisi Mesin: ${engineGoodCount} dari ${sortedReports.length} minggu tercatat BAIK (${Math.round(engineGoodCount / sortedReports.length * 100)}%). ` +
                    `${engineProblemCount > 0 ? `Terdapat ${engineProblemCount} catatan indikasi perlu perbaikan pada mesin.` : 'Mesin dalam status prima tanpa kendala transmisi/pengapian.'}\n` +
                    `Kondisi Fisik Body: ${bodyGoodCount} minggu BAIK. ` +
                    `${bodyIssueCount > 0 ? `Terdapat ${bodyIssueCount} minggu dengan catatan lecet/penyok yang memerlukan perbaikan eksterior.` : 'Body kendaraan rapi dan bebas dari kerusakan benturan.'}`
                ],
                [
                    'C. Evaluasi Disiplin & Perawatan Pengemudi (PIC)',
                    `Tingkat Kebersihan: ${cleanlinessRate}% minggu unit dilaporkan dalam keadaan Bersih & Terawat (${cleanCount}/${sortedReports.length} minggu).\n` +
                    `Kepatuhan Pengisian Laporan: ${sortedReports.length} minggu laporan berhasil diverifikasi oleh sistem.`
                ],
                [
                    'D. Rekomendasi Pemeliharaan & Tindak Lanjut Manajemen',
                    `1. Servis Berkala: Pengecekan interval servis berkala berikutnya pada bengkel rekanan resmi Sarpras.\n` +
                    `2. Perawatan Fisik: ${bodyIssueCount > 0 ? 'Jadwalkan perbaikan poles body / ketok pada unit untuk mempertahankan nilai aset.' : 'Pertahankan standar perawatan kebersihan unit.'}\n` +
                    `3. Manajemen Operasional: ${avgWeeklyKm > 900 ? 'Pertimbangkan rotasi penugasan armada dengan kendaraan cadangan guna mencegah kelelahan mesin berlebih.' : 'Kendaraan siap ditugaskan secara optimal untuk agenda operasional mendatang.'}`
                ]
            ];

            doc.autoTable({
                startY: currentY + 3,
                head: [['ASPEK EVALUASI MANAJEMEN', 'DESKRIPSI ANALISIS HASIL PENGAWASAN']],
                body: analysisRows,
                theme: 'grid',
                headStyles: { fillColor: [30, 41, 59], fontSize: 8, fontStyle: 'bold' },
                bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59], cellPadding: 3.5 },
                columnStyles: {
                    0: { cellWidth: 55, fontStyle: 'bold', textColor: [79, 70, 229] },
                    1: { cellWidth: 'auto' }
                },
                margin: { left: 14, right: 14 }
            });

            // 5. TANDA TANGAN PENGESAHAN
            let signY = doc.lastAutoTable.finalY + 12;
            if (signY > pageH - 40) {
                doc.addPage();
                signY = 25;
            }

            doc.setFontSize(8.5);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(51, 65, 85);

            // Left: Mengetahui
            doc.text('Mengetahui & Menyetujui,', 25, signY);
            doc.text('Kepala Bidang Sarana & Prasarana', 25, signY + 4);
            doc.text('( .................................................... )', 25, signY + 24);

            // Right: PIC / Pelapor
            doc.text('Padang, ' + now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }), pageW - 75, signY);
            doc.text('PIC / Supir Pengemudi Kendaraan,', pageW - 75, signY + 4);
            doc.text(`( ${vehicle.pics?.[0]?.name || 'Petugas Penanggung Jawab'} )`, pageW - 75, signY + 24);

            // Footer with page numbering
            const totalPages = doc.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                doc.setFontSize(7.5);
                doc.setFont(undefined, 'normal');
                doc.setTextColor(148, 163, 184);
                doc.text(
                    `Halaman ${i} dari ${totalPages}  |  Sistem Informasi Manajemen Kendaraan - Bidang Sarpras Yayasan Dar El-Iman`,
                    pageW / 2,
                    pageH - 8,
                    { align: 'center' }
                );
            }

            const cleanFileName = `Laporan_Mingguan_${(vehicle.plateNumber || 'Kendaraan').replace(/[^a-zA-Z0-9]/g, '_')}_${periodLabel.replace(/[/ ]/g, '_')}.pdf`;
            doc.save(cleanFileName);
        } catch (err) {
            console.error('Weekly Report PDF Export Error:', err);
            alert('Terjadi kesalahan saat memproses ekspor PDF: ' + err.message);
        } finally {
            setExporting(false);
        }
    };

    if (loading) return <div className="p-10 text-center text-slate-500 font-medium">Memuat data laporan kendaraan...</div>;
    if (!vehicle) return <div className="p-10 text-center text-red-500 font-bold">Kendaraan tidak ditemukan</div>;

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-10">
            {/* Top Navigation */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <button
                    onClick={() => navigate('/kendaraan/data')}
                    className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-semibold text-sm transition-colors"
                >
                    <ArrowLeft size={18} /> Kembali ke Daftar Kendaraan
                </button>

                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl">
                    <ShieldCheck size={14} className="text-emerald-600" />
                    <span>Modul Manajemen Kendaraan & Sarpras</span>
                </div>
            </div>

            {/* Vehicle Header Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shadow-inner">
                        <Car size={32} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-black text-slate-800">{vehicle.name}</h1>
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase ${vehicle.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                {vehicle.status === 'ACTIVE' ? 'Aktif' : 'Non-Aktif'}
                            </span>
                        </div>
                        <p className="text-slate-500 font-mono text-sm font-bold uppercase tracking-wider">{vehicle.plateNumber}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {vehicle.brand || ''} {vehicle.model || ''} • {vehicle.type || 'KENDARAAN'} • BBM: {vehicle.fuelType || 'Bensin'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200/80 text-right">
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Odometer Terkini</p>
                        <p className="text-base font-black text-slate-800 font-mono">
                            {vehicle.odometer ? vehicle.odometer.toLocaleString('id-ID') : 0} <span className="text-xs font-bold text-slate-400">KM</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* Main Content Grid: Form Input + History */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form Input */}
                <div className="lg:col-span-1">
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm sticky top-6">
                        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <ClipboardList className="text-blue-600" size={20} /> Input Laporan Baru
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase">Periode (Sabtu - Jumat)</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        type="date"
                                        readOnly
                                        className="w-full p-2 bg-slate-100 text-slate-500 border border-slate-200 rounded-lg text-sm cursor-not-allowed"
                                        value={form.weekStartDate}
                                        onChange={e => setForm({ ...form, weekStartDate: e.target.value })}
                                    />
                                    <input
                                        type="date"
                                        readOnly
                                        className="w-full p-2 bg-slate-100 text-slate-500 border border-slate-200 rounded-lg text-sm cursor-not-allowed"
                                        value={form.weekEndDate}
                                        onChange={e => setForm({ ...form, weekEndDate: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase text-nowrap">KM Awal</label>
                                    <input
                                        type="number"
                                        readOnly
                                        className="w-full p-2 bg-slate-100 text-slate-500 border border-slate-200 rounded-lg text-sm cursor-not-allowed"
                                        value={form.startOdometer}
                                        onChange={e => setForm({ ...form, startOdometer: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase text-nowrap">KM Akhir</label>
                                    <input
                                        type="number"
                                        placeholder="KM Akhir"
                                        className="w-full p-2 bg-white text-slate-800 border border-slate-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={form.endOdometer}
                                        onChange={e => setForm({ ...form, endOdometer: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase">Kondisi Mesin</label>
                                <select
                                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                                    value={form.conditionEngine}
                                    onChange={e => setForm({ ...form, conditionEngine: e.target.value })}
                                >
                                    <option value="BAIK">Baik</option>
                                    <option value="PERLU_PERBAIKAN">Perlu Perbaikan</option>
                                    <option value="RUSAK">Rusak</option>
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase">Kondisi Body</label>
                                <select
                                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                                    value={form.conditionBody}
                                    onChange={e => setForm({ ...form, conditionBody: e.target.value })}
                                >
                                    <option value="BAIK">Baik</option>
                                    <option value="LECET">Lecet</option>
                                    <option value="PENYOK">Penyok / Rusak</option>
                                </select>
                            </div>

                            <div className="space-y-4 pt-2">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        checked={form.isClean}
                                        onChange={e => setForm({ ...form, isClean: e.target.checked })}
                                    />
                                    <span className="text-sm text-slate-600 group-hover:text-blue-600 transition-colors font-medium">Unit Bersih & Terawat</span>
                                </label>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase">Catatan & Keluhan</label>
                                <textarea
                                    rows={3}
                                    placeholder="Keluhan atau catatan lainnya..."
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    value={form.notes}
                                    onChange={e => setForm({ ...form, notes: e.target.value })}
                                ></textarea>
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all disabled:opacity-50 mt-4"
                            >
                                {submitting ? 'Menyimpan...' : 'Simpan Laporan'}
                            </button>
                        </form>
                    </div>
                </div>

                {/* History List with Date Filter & Download PDF */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Filter & Action Toolbar */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <Filter size={18} className="text-indigo-600" />
                                <span className="text-sm font-bold text-slate-800">Filter Rentang Tanggal</span>
                            </div>
                            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                                {filteredReports.length} dari {reports.length} Laporan
                            </span>
                        </div>

                        {/* Preset Buttons */}
                        <div className="flex flex-wrap items-center gap-2">
                            {[
                                { key: 'all', label: 'Semua' },
                                { key: 'this_month', label: 'Bulan Ini' },
                                { key: 'last_month', label: 'Bulan Lalu' },
                                { key: '30d', label: '30 Hari Terakhir' },
                                { key: 'custom', label: 'Kustom' }
                            ].map(p => (
                                <button
                                    key={p.key}
                                    onClick={() => handleApplyPreset(p.key)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                        filterPreset === p.key
                                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>

                        {/* Date Inputs if Custom or Active Range */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    value={dateRange.startDate}
                                    onChange={(e) => {
                                        setFilterPreset('custom');
                                        setDateRange(prev => ({ ...prev, startDate: e.target.value }));
                                    }}
                                    className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <span className="text-xs font-bold text-slate-400">s/d</span>
                                <input
                                    type="date"
                                    value={dateRange.endDate}
                                    onChange={(e) => {
                                        setFilterPreset('custom');
                                        setDateRange(prev => ({ ...prev, endDate: e.target.value }));
                                    }}
                                    className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            {/* Download PDF Button */}
                            <button
                                onClick={handleExportPDF}
                                disabled={exporting || filteredReports.length === 0}
                                className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-tight shadow-md shadow-emerald-200 transition-all disabled:opacity-50"
                            >
                                {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                                <span>{exporting ? 'Mengekspor PDF...' : 'Unduh PDF Laporan'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Reports List */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-50 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Calendar className="text-blue-600" size={20} /> Riwayat Laporan Mingguan
                            </h2>
                            <span className="text-xs text-slate-400 font-bold uppercase">{filteredReports.length} Laporan Ditemukan</span>
                        </div>

                        <div className="divide-y divide-slate-50">
                            {filteredReports.length === 0 ? (
                                <div className="p-16 text-center text-slate-400 italic">
                                    Tidak ada laporan mingguan dalam rentang tanggal yang dipilih.
                                </div>
                            ) : (
                                filteredReports.map(report => (
                                    <div key={report.id} className="p-6 hover:bg-slate-50 transition-colors">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold text-slate-700">Minggu Ke- </span>
                                                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded uppercase">
                                                        {new Date(report.weekStartDate).toLocaleDateString('id-ID')} - {new Date(report.weekEndDate).toLocaleDateString('id-ID')}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-slate-400 font-medium">Dilaporkan oleh: {report.user?.name || 'User'}</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                                <p className="text-[10px] text-slate-400 font-bold uppercase mb-1 flex items-center gap-1">
                                                    <Gauge size={10} /> Odometer
                                                </p>
                                                <p className="text-sm font-bold text-slate-800">{report.startOdometer} - {report.endOdometer} km</p>
                                                <span className="text-[10px] text-blue-500 font-medium">+{(report.endOdometer - report.startOdometer).toLocaleString()} km seminggu</span>
                                            </div>
                                            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                                <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Mesin</p>
                                                <div className="flex items-center gap-1.5">
                                                    <div className={`w-2 h-2 rounded-full ${report.conditionEngine === 'BAIK' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                                    <p className="text-xs font-bold text-slate-700">{report.conditionEngine}</p>
                                                </div>
                                            </div>
                                            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                                <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Body</p>
                                                <div className="flex items-center gap-1.5">
                                                    <div className={`w-2 h-2 rounded-full ${report.conditionBody === 'BAIK' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                                    <p className="text-xs font-bold text-slate-700">{report.conditionBody}</p>
                                                </div>
                                            </div>
                                            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                                <p className="text-[10px] text-slate-400 font-bold uppercase mb-1 text-nowrap">Kebersihan</p>
                                                <div className="flex items-center gap-1.5">
                                                    {report.isClean ?
                                                        <CheckCircle2 size={14} className="text-green-500" /> :
                                                        <AlertCircle size={14} className="text-red-400" />
                                                    }
                                                    <p className="text-xs font-bold text-slate-700">{report.isClean ? 'Bersih' : 'Kurang Bersih'}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {report.notes && (
                                            <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200">
                                                <p className="text-[10px] text-slate-400 font-bold uppercase mb-2">Catatan:</p>
                                                <p className="text-xs text-slate-600 leading-relaxed italic">"{report.notes}"</p>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VehicleWeeklyReport;
