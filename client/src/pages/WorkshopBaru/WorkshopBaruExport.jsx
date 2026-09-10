import React, { useState, useEffect } from 'react';
import {
    FileSpreadsheet,
    Download,
    Printer,
    Search,
    Calendar,
    Filter,
    ArrowLeft,
    HardHat,
    CheckCircle2,
    Clock,
    DollarSign,
    Layers,
    FileText,
    Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Swal from 'sweetalert2';

export default function WorkshopBaruExport() {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [units, setUnits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [exportingPDF, setExportingPDF] = useState(false);

    // Filter states
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [priorityFilter, setPriorityFilter] = useState('ALL');
    const [unitFilter, setUnitFilter] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [ordersRes, unitsRes] = await Promise.all([
                api.get('/workshop/orders'),
                api.get('/master/units')
            ]);
            setOrders(ordersRes.data || []);
            setUnits(unitsRes.data || []);
        } catch (error) {
            console.error('Failed to load orders for export:', error);
            Swal.fire('Error', 'Gagal memuat data pekerjaan workshop.', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Filtered orders calculation
    const filteredOrders = orders.filter(order => {
        // Date range
        if (startDate) {
            const oDate = new Date(order.orderDate || order.createdAt);
            if (oDate < new Date(startDate)) return false;
        }
        if (endDate) {
            const oDate = new Date(order.orderDate || order.createdAt);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            if (oDate > end) return false;
        }

        // Status
        if (statusFilter !== 'ALL' && order.status !== statusFilter) return false;

        // Priority
        if (priorityFilter !== 'ALL' && order.priority !== priorityFilter) return false;

        // Unit
        if (unitFilter !== 'ALL' && String(order.unitId) !== String(unitFilter)) return false;

        // Search
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const matchCode = (order.code || '').toLowerCase().includes(q);
            const matchTitle = (order.title || '').toLowerCase().includes(q);
            const matchUnit = (order.unit?.name || '').toLowerCase().includes(q);
            const matchRequester = (order.requestedBy?.name || '').toLowerCase().includes(q);
            if (!matchCode && !matchTitle && !matchUnit && !matchRequester) return false;
        }

        return true;
    });

    // Summary Metrics
    const totalJobs = filteredOrders.length;
    const totalEstimated = filteredOrders.reduce((sum, o) => sum + (parseFloat(o.estimatedCost) || 0), 0);
    const totalActual = filteredOrders.reduce((sum, o) => sum + (parseFloat(o.actualCost) || 0), 0);
    const completedJobs = filteredOrders.filter(o => o.status === 'COMPLETED').length;
    const inProgressJobs = filteredOrders.filter(o => o.status === 'IN_PROGRESS' || o.status === 'QUALITY_CHECK').length;

    // Export to Excel / CSV
    const handleExportCSV = () => {
        if (filteredOrders.length === 0) {
            return Swal.fire('Informasi', 'Tidak ada data untuk diekspor.', 'info');
        }

        const headers = [
            'No',
            'Kode Pesanan',
            'Tanggal Pesan',
            'Judul Pekerjaan',
            'Unit Pemesan',
            'Prioritas',
            'Status',
            'Estimasi Biaya (Rp)',
            'Realisasi Biaya (Rp)',
            'Catatan'
        ];

        const rows = filteredOrders.map((o, idx) => [
            idx + 1,
            `"${o.code || '-'}"`,
            `"${new Date(o.orderDate || o.createdAt).toLocaleDateString('id-ID')}"`,
            `"${(o.title || '').replace(/"/g, '""')}"`,
            `"${(o.unit?.name || '-').replace(/"/g, '""')}"`,
            o.priority || 'NORMAL',
            o.status || 'PENDING',
            parseFloat(o.estimatedCost || 0),
            parseFloat(o.actualCost || 0),
            `"${(o.notes || '-').replace(/"/g, '""')}"`
        ]);

        const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Rekap_Pekerjaan_Workshop_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Export to PDF Resmi (Kop Bidang Sarana + TTD Ravi Kurnia)
    const handleExportPDF = () => {
        if (filteredOrders.length === 0) {
            return Swal.fire('Informasi', 'Tidak ada data untuk diekspor ke PDF.', 'info');
        }

        try {
            setExportingPDF(true);
            const doc = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            const pageW = doc.internal.pageSize.getWidth();
            const pageH = doc.internal.pageSize.getHeight();

            // KOP SURAT BIDANG SARANA
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.setTextColor(15, 23, 42); // slate-900
            doc.text('BIDANG SARANA', pageW / 2, 14, { align: 'center' });

            doc.setFontSize(9);
            doc.setTextColor(30, 58, 138); // blue-900
            doc.text('YAYASAN DAR EL-IMAN PADANG', pageW / 2, 19, { align: 'center' });

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(71, 85, 105); // slate-600
            doc.text('Unit Pelaksana Teknis Workshop & Fabrikasi (Unit 21)', pageW / 2, 23, { align: 'center' });
            doc.text('Jl. Gunuang Juaro, Surau Gadang, Kec. Nanggalo, Kota Padang, Sumatera Barat', pageW / 2, 27, { align: 'center' });

            // Garis pembatas kop
            doc.setDrawColor(15, 23, 42);
            doc.setLineWidth(0.7);
            doc.line(14, 30, pageW - 14, 30);
            doc.setLineWidth(0.2);
            doc.line(14, 31, pageW - 14, 31);

            // JUDUL DOKUMEN
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(15, 23, 42);
            doc.text('REKAPITULASI LAPORAN PEKERJAAN WORKSHOP', pageW / 2, 38, { align: 'center' });

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            const periodStr = (startDate || endDate) 
                ? `Periode: ${startDate ? new Date(startDate).toLocaleDateString('id-ID') : 'Awal'} s.d. ${endDate ? new Date(endDate).toLocaleDateString('id-ID') : 'Sekarang'}`
                : `Semua Periode Pengerjaan (Dicetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })})`;
            doc.text(periodStr, pageW / 2, 43, { align: 'center' });

            // METRIC SUMMARY BOXES
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(14, 47, pageW - 28, 12, 2, 2, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(30, 41, 59);

            const mY = 54;
            doc.text(`Total Pekerjaan: ${totalJobs}`, 20, mY);
            doc.text(`Selesai: ${completedJobs}`, 70, mY);
            doc.text(`Sedang Dikerjakan: ${inProgressJobs}`, 110, mY);
            doc.text(`Total Estimasi Biaya: Rp ${totalEstimated.toLocaleString('id-ID')}`, 165, mY);
            doc.text(`Total Realisasi Biaya: Rp ${totalActual.toLocaleString('id-ID')}`, 230, mY);

            // TABEL DATA PEKERJAAN
            const tableHeaders = [
                ['No', 'Kode Order', 'Tgl Pesan', 'Judul Pekerjaan', 'Unit Pemesan', 'Prioritas', 'Status', 'Estimasi (Rp)', 'Realisasi (Rp)']
            ];

            const tableData = filteredOrders.map((o, i) => [
                i + 1,
                o.code || '-',
                new Date(o.orderDate || o.createdAt).toLocaleDateString('id-ID'),
                o.title || '-',
                o.unit?.name || '-',
                o.priority || 'NORMAL',
                o.status || 'PENDING',
                (parseFloat(o.estimatedCost) || 0).toLocaleString('id-ID'),
                (parseFloat(o.actualCost) || 0).toLocaleString('id-ID')
            ]);

            autoTable(doc, {
                startY: 63,
                head: tableHeaders,
                body: tableData,
                theme: 'grid',
                headStyles: {
                    fillColor: [15, 23, 42],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    fontSize: 8,
                    halign: 'center'
                },
                bodyStyles: {
                    fontSize: 7.5,
                    textColor: [51, 65, 85]
                },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 10 },
                    1: { fontStyle: 'bold', cellWidth: 28 },
                    2: { halign: 'center', cellWidth: 22 },
                    3: { cellWidth: 'auto' },
                    4: { cellWidth: 35 },
                    5: { halign: 'center', cellWidth: 20 },
                    6: { halign: 'center', cellWidth: 25 },
                    7: { halign: 'right', cellWidth: 26 },
                    8: { halign: 'right', cellWidth: 26 }
                },
                margin: { left: 14, right: 14, bottom: 45 }
            });

            // BLOK TANDA TANGAN RESMI KEPALA BIDANG SARANA
            const finalY = doc.lastAutoTable.finalY + 8;
            const signY = (finalY + 35 > pageH) ? 14 : finalY;
            if (finalY + 35 > pageH) {
                doc.addPage();
            }

            const signX = pageW - 65;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(71, 85, 105);
            doc.text('Padang, ' + new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }), signX + 15, signY, { align: 'center' });
            doc.text('Mengetahui,', signX + 15, signY + 4, { align: 'center' });

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(15, 23, 42);
            doc.text('Kepala Bidang Sarana', signX + 15, signY + 9, { align: 'center' });

            // Tanda tangan nama
            doc.setFontSize(9);
            doc.text('Ravi Kurnia', signX + 15, signY + 30, { align: 'center' });
            doc.setLineWidth(0.3);
            doc.line(signX, signY + 31, signX + 30, signY + 31);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(100, 116, 139);
            doc.text('Yayasan Dar El-Iman', signX + 15, signY + 35, { align: 'center' });

            // FOOTER & NOMOR HALAMAN
            const totalPages = doc.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7);
                doc.setTextColor(148, 163, 184);
                doc.text(`Halaman ${i} dari ${totalPages}  |  Sistem Informasi Manajemen Workshop Unit 21 - Bidang Sarana`, pageW / 2, pageH - 6, { align: 'center' });
            }

            doc.save(`Rekap_Pekerjaan_Workshop_${new Date().toISOString().slice(0, 10)}.pdf`);
        } catch (err) {
            console.error('Export PDF Error:', err);
            Swal.fire('Error', 'Gagal mengekspor PDF: ' + err.message, 'error');
        } finally {
            setExportingPDF(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 pb-24">
            {/* Top Navigation */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/workshop-baru/dashboard')}
                        className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black text-slate-800 flex items-center gap-2">
                            <FileSpreadsheet className="text-emerald-600" size={24} /> Ekspor Laporan Pekerjaan Workshop
                        </h1>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Rekapitulasi resmi pekerjaan fabrikasi Unit 21 dengan Kop Bidang Sarana dan format PDF/Excel
                        </p>
                    </div>
                </div>

                {/* Export Action Buttons */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExportCSV}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-sm"
                        title="Download Data Format Spreadsheet CSV / Excel"
                    >
                        <Download size={15} /> Ekspor Excel / CSV
                    </button>

                    <button
                        onClick={handleExportPDF}
                        disabled={exportingPDF}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50 hover:scale-105"
                        title="Unduh Dokumen PDF Resmi Kop Bidang Sarana"
                    >
                        {exportingPDF ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
                        {exportingPDF ? 'Mengekspor PDF...' : 'Ekspor PDF Resmi'}
                    </button>
                </div>
            </div>

            {/* Metrics KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                    <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                        <HardHat size={14} className="text-slate-400" /> Total Pekerjaan
                    </span>
                    <p className="text-2xl font-black text-slate-800">{totalJobs}</p>
                    <p className="text-[10px] text-slate-400">Sesuai filter pencarian</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                    <span className="text-[11px] font-bold text-emerald-600 uppercase flex items-center gap-1.5">
                        <CheckCircle2 size={14} /> Selesai Dikerjakan
                    </span>
                    <p className="text-2xl font-black text-emerald-600">{completedJobs}</p>
                    <p className="text-[10px] text-slate-400">Pekerjaan rampung</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                    <span className="text-[11px] font-bold text-blue-600 uppercase flex items-center gap-1.5">
                        <Clock size={14} /> Sedang Berjalan
                    </span>
                    <p className="text-2xl font-black text-blue-600">{inProgressJobs}</p>
                    <p className="text-[10px] text-slate-400">Dalam pengerjaan & QC</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                    <span className="text-[11px] font-bold text-indigo-600 uppercase flex items-center gap-1.5">
                        <DollarSign size={14} /> Total Estimasi
                    </span>
                    <p className="text-lg sm:text-xl font-black text-indigo-700">
                        Rp {totalEstimated.toLocaleString('id-ID')}
                    </p>
                    <p className="text-[10px] text-slate-400">Estimasi biaya material</p>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                    <Filter size={15} className="text-emerald-600" /> Filter Data Pekerjaan
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                    {/* Date range start */}
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Tgl Mulai</label>
                        <input
                            type="date"
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                        />
                    </div>

                    {/* Date range end */}
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Tgl Akhir</label>
                        <input
                            type="date"
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                        />
                    </div>

                    {/* Status */}
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Status</label>
                        <select
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none bg-white font-medium"
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                        >
                            <option value="ALL">Semua Status</option>
                            <option value="DRAFT">Draft</option>
                            <option value="PENDING">Menunggu Pengerjaan</option>
                            <option value="IN_PROGRESS">Sedang Dikerjakan</option>
                            <option value="QUALITY_CHECK">Quality Check (QC)</option>
                            <option value="COMPLETED">Selesai</option>
                            <option value="CANCELLED">Dibatalkan</option>
                        </select>
                    </div>

                    {/* Priority */}
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Prioritas</label>
                        <select
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none bg-white font-medium"
                            value={priorityFilter}
                            onChange={e => setPriorityFilter(e.target.value)}
                        >
                            <option value="ALL">Semua Prioritas</option>
                            <option value="LOW">Low</option>
                            <option value="NORMAL">Normal</option>
                            <option value="HIGH">High</option>
                            <option value="URGENT">Urgent</option>
                        </select>
                    </div>

                    {/* Unit */}
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Unit Pemesan</label>
                        <select
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none bg-white font-medium"
                            value={unitFilter}
                            onChange={e => setUnitFilter(e.target.value)}
                        >
                            <option value="ALL">Semua Unit</option>
                            {units.map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="relative pt-1">
                    <Search className="absolute left-3 top-3.5 text-slate-400" size={16} />
                    <input
                        type="text"
                        className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                        placeholder="Cari kode order, nama pekerjaan, unit pemesan, atau nama pemohon..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Table Preview */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        <Layers size={16} className="text-emerald-600" /> Pratinjau Data Rekapitulasi ({filteredOrders.length} Pesanan)
                    </h3>
                    {(startDate || endDate || statusFilter !== 'ALL' || priorityFilter !== 'ALL' || unitFilter !== 'ALL' || searchQuery) && (
                        <button
                            onClick={() => {
                                setStartDate('');
                                setEndDate('');
                                setStatusFilter('ALL');
                                setPriorityFilter('ALL');
                                setUnitFilter('ALL');
                                setSearchQuery('');
                            }}
                            className="text-xs text-rose-600 hover:underline font-semibold"
                        >
                            Reset Filter
                        </button>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                            <tr>
                                <th className="p-3.5 w-12 text-center">No</th>
                                <th className="p-3.5">Kode Order</th>
                                <th className="p-3.5">Tanggal</th>
                                <th className="p-3.5">Judul Pekerjaan</th>
                                <th className="p-3.5">Unit Pemesan</th>
                                <th className="p-3.5 text-center">Prioritas</th>
                                <th className="p-3.5 text-center">Status</th>
                                <th className="p-3.5 text-right">Estimasi Biaya</th>
                                <th className="p-3.5 text-right">Realisasi Biaya</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {loading ? (
                                <tr>
                                    <td colSpan="9" className="text-center py-12 text-slate-400">
                                        <Loader2 className="animate-spin inline-block mr-2" size={18} /> Memuat data...
                                    </td>
                                </tr>
                            ) : filteredOrders.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="text-center py-12 text-slate-400">
                                        Tidak ada pekerjaan workshop yang sesuai kriteria filter.
                                    </td>
                                </tr>
                            ) : (
                                filteredOrders.map((order, idx) => (
                                    <tr 
                                        key={order.id}
                                        onClick={() => navigate(`/workshop-baru/orders/${order.id}`)}
                                        className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                                    >
                                        <td className="p-3.5 text-center font-mono text-slate-400">{idx + 1}</td>
                                        <td className="p-3.5 font-bold font-mono text-emerald-700">{order.code}</td>
                                        <td className="p-3.5 text-slate-500">
                                            {new Date(order.orderDate || order.createdAt).toLocaleDateString('id-ID')}
                                        </td>
                                        <td className="p-3.5 font-medium max-w-xs truncate">{order.title}</td>
                                        <td className="p-3.5 text-slate-600 font-semibold">{order.unit?.name || '-'}</td>
                                        <td className="p-3.5 text-center">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                order.priority === 'URGENT' ? 'bg-rose-100 text-rose-800' :
                                                order.priority === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                                                order.priority === 'LOW' ? 'bg-slate-100 text-slate-700' :
                                                'bg-blue-100 text-blue-800'
                                            }`}>
                                                {order.priority || 'NORMAL'}
                                            </span>
                                        </td>
                                        <td className="p-3.5 text-center">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                order.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                                                order.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                                                order.status === 'QUALITY_CHECK' ? 'bg-purple-100 text-purple-800' :
                                                order.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                                                'bg-amber-100 text-amber-800'
                                            }`}>
                                                {order.status || 'PENDING'}
                                            </span>
                                        </td>
                                        <td className="p-3.5 text-right font-mono font-medium">
                                            Rp {(parseFloat(order.estimatedCost) || 0).toLocaleString('id-ID')}
                                        </td>
                                        <td className="p-3.5 text-right font-mono font-bold text-slate-800">
                                            Rp {(parseFloat(order.actualCost) || 0).toLocaleString('id-ID')}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
