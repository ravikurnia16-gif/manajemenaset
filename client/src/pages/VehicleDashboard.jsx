import { useState, useEffect, useRef } from 'react';
import { Car, Calendar, Wrench, AlertOctagon, TrendingUp, Loader2, Fuel, DollarSign, Activity, AlertCircle, Gauge, Filter, Download, Trophy, Clock, CheckCircle2, MapPin, User, Navigation2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, Cell, PieChart, Pie } from 'recharts';
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


const StatCard = ({ title, value, icon: Icon, color, desc }) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-start justify-between hover:shadow-md transition-all">
        <div>
            <p className="text-slate-500 text-xs font-black uppercase tracking-widest mb-1">{title}</p>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">{value}</h3>
            {desc && <p className="text-[10px] font-bold text-slate-400 mt-2 bg-slate-50 px-2 py-0.5 rounded-full inline-block">{desc}</p>}
        </div>
        <div className={`p-3 rounded-xl ${color} text-white shadow-lg`}>
            <Icon size={24} />
        </div>
    </div>
);

const BOOKING_STATUS_MAP = {
    'PENDING': { label: 'Menunggu', color: 'bg-amber-100 text-amber-700' },
    'APPROVED': { label: 'Disetujui', color: 'bg-blue-100 text-blue-700' },
    'BERLANGSUNG': { label: 'Berjalan', color: 'bg-indigo-100 text-indigo-700' },
    'COMPLETED': { label: 'Selesai', color: 'bg-emerald-100 text-emerald-700' },
    'REJECTED': { label: 'Ditolak', color: 'bg-red-100 text-red-700' },
    'CANCELLED': { label: 'Dibatalkan', color: 'bg-slate-100 text-slate-500' },
};

const VehicleDashboard = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState({ month: '', year: '' });
    const [exporting, setExporting] = useState(false);
    const dashboardRef = useRef(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const query = filter.month && filter.year ? `?month=${filter.month}&year=${filter.year}` : '';
                const res = await api.get(`/vehicles/dashboard${query}`);
                setData(res.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [filter]);

    const handleFilterChange = (val) => {
        if (val === 'summary') {
            setFilter({ month: '', year: '' });
        } else {
            const [y, m] = val.split('-');
            setFilter({ month: m, year: y });
        }
    };

    // --- PDF EXPORT ---
    const handleExportPDF = async () => {
        if (!data) return;
        setExporting(true);
        try {
            const jsPDF = await loadJsPDF();
            const doc = new jsPDF('landscape', 'mm', 'a4');
            const pageW = doc.internal.pageSize.getWidth();
            const now = new Date();
            const periodLabel = data.isSummary ? 'Ringkasan Keseluruhan' : `Bulan ${data.period}`;

            // Header
            doc.setFontSize(18);
            doc.setFont(undefined, 'bold');
            doc.text('LAPORAN DASHBOARD ARMADA', pageW / 2, 18, { align: 'center' });
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.text(`Periode: ${periodLabel}  |  Tanggal Cetak: ${now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, pageW / 2, 25, { align: 'center' });

            // KPI Summary
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text('Ringkasan KPI', 14, 35);
            doc.autoTable({
                startY: 38,
                head: [['Total Armada', 'Efisiensi (KM/L)', 'Total Biaya BBM', 'Biaya Service (Tahunan)']],
                body: [[
                    data.stats.totalVehicles,
                    (data.stats.fleetKml || 0).toFixed(1),
                    `Rp ${Math.round(data.stats.totalFuelCost || 0).toLocaleString('id-ID')}`,
                    `Rp ${Math.round(data.stats.totalServiceCostYearly || 0).toLocaleString('id-ID')}`
                ]],
                theme: 'grid',
                headStyles: { fillColor: [99, 102, 241], fontSize: 9, fontStyle: 'bold' },
                bodyStyles: { fontSize: 10, fontStyle: 'bold' },
                margin: { left: 14, right: 14 }
            });

            // Availability
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text('Status Ketersediaan Armada', 14, doc.lastAutoTable.finalY + 10);
            doc.autoTable({
                startY: doc.lastAutoTable.finalY + 13,
                head: [['Tersedia', 'Sedang Digunakan', 'Total Armada']],
                body: [[data.availability?.available || 0, data.availability?.onTrip || 0, data.availability?.total || 0]],
                theme: 'grid',
                headStyles: { fillColor: [16, 185, 129], fontSize: 9, fontStyle: 'bold' },
                bodyStyles: { fontSize: 10, fontStyle: 'bold' },
                margin: { left: 14, right: 14 }
            });

            // Performance Matrix
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text('Matriks Performa Kendaraan', 14, doc.lastAutoTable.finalY + 10);
            const vStatsRows = (data.vStats || []).map((v, i) => [
                i + 1, v.name, v.plate,
                (v.kml || 0).toFixed(1) + ' KM/L',
                (v.utilization || 0).toFixed(0) + '%',
                `Rp ${Math.round(v.cpkm || 0).toLocaleString('id-ID')}`,
                (v.totalKm || 0).toLocaleString('id-ID') + ' KM'
            ]);
            doc.autoTable({
                startY: doc.lastAutoTable.finalY + 13,
                head: [['#', 'Kendaraan', 'Plat', 'Efisiensi', 'Utilisasi', 'Cost/KM', 'Total Jarak']],
                body: vStatsRows,
                theme: 'striped',
                headStyles: { fillColor: [99, 102, 241], fontSize: 8, fontStyle: 'bold' },
                bodyStyles: { fontSize: 8 },
                margin: { left: 14, right: 14 }
            });

            // Efficiency Ranking
            const sorted = [...(data.vStats || [])].filter(v => v.fuelCpkm > 0).sort((a, b) => a.fuelCpkm - b.fuelCpkm);
            doc.addPage();
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text('Peringkat Efisiensi BBM (Rp/KM)', 14, 18);
            const rankRows = sorted.map((v, i) => [
                i + 1, v.name, v.plate, `Rp ${Math.round(v.fuelCpkm || 0).toLocaleString('id-ID')}/KM`,
                (v.totalKm || 0).toLocaleString('id-ID') + ' KM',
                i === 0 ? '🏆 Terhemat' : i === sorted.length - 1 ? '⚠️ Terboros' : ''
            ]);
            doc.autoTable({
                startY: 22,
                head: [['Rank', 'Kendaraan', 'Plat', 'Biaya BBM/KM', 'Total Jarak', 'Keterangan']],
                body: rankRows,
                theme: 'striped',
                headStyles: { fillColor: [245, 158, 11], fontSize: 8, fontStyle: 'bold' },
                bodyStyles: { fontSize: 8 },
                margin: { left: 14, right: 14 }
            });

            // Recent Bookings
            if (data.recentBookings?.length > 0) {
                doc.setFontSize(12);
                doc.setFont(undefined, 'bold');
                doc.text('Riwayat Peminjaman Terbaru', 14, doc.lastAutoTable.finalY + 10);
                const bookingRows = data.recentBookings.map(b => [
                    b.vehicle?.name || '-', b.vehicle?.plateNumber || '-',
                    b.user?.name || b.user?.username || '-',
                    b.destination || '-',
                    BOOKING_STATUS_MAP[b.status]?.label || b.status,
                    new Date(b.startDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
                ]);
                doc.autoTable({
                    startY: doc.lastAutoTable.finalY + 13,
                    head: [['Kendaraan', 'Plat', 'Peminjam', 'Tujuan', 'Status', 'Tanggal']],
                    body: bookingRows,
                    theme: 'striped',
                    headStyles: { fillColor: [59, 130, 246], fontSize: 8, fontStyle: 'bold' },
                    bodyStyles: { fontSize: 8 },
                    margin: { left: 14, right: 14 }
                });
            }

            // Footer
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setFont(undefined, 'normal');
                doc.text(`Halaman ${i} dari ${pageCount}  |  Dicetak oleh Sistem Manajemen Aset`, pageW / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
            }

            doc.save(`Laporan_Armada_${periodLabel.replace(/[/ ]/g, '_')}_${now.toISOString().slice(0, 10)}.pdf`);
        } catch (err) {
            console.error('PDF Export Error:', err);
        } finally {
            setExporting(false);
        }
    };

    const [payModal, setPayModal] = useState(null); // { vId, type, label }
    const [payCost, setPayCost] = useState('');

    const openPayModal = (vId, type) => {
        const labels = { TAX: 'Pajak Tahunan', STNK: 'Pajak 5 Tahunan (STNK)', KIR: 'Uji KIR' };
        setPayModal({ vId, type, label: labels[type] || type });
        setPayCost('');
    };

    const handleMarkPaid = async () => {
        if (!payModal) return;
        try {
            const res = await api.put(`/vehicles/${payModal.vId}/mark-paid`, { type: payModal.type, cost: parseFloat(payCost) || 0 });
            setPayModal(null);
            // Reload data
            setLoading(true);
            try {
                const query = filter.month && filter.year ? `?month=${filter.month}&year=${filter.year}` : '';
                const dashRes = await api.get(`/vehicles/dashboard${query}`);
                setData(dashRes.data);
            } catch (err) { console.error(err); }
            finally { setLoading(false); }
            alert(res.data.message);
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.error || 'Gagal memperbarui data');
        }
    };

    if (loading && !data) return (
        <div className="flex h-96 items-center justify-center">
            <Loader2 className="animate-spin text-indigo-600" size={40} />
        </div>
    );

    const stats = [
        { title: "Total Armada", value: data?.stats?.totalVehicles || 0, icon: Car, color: "bg-slate-800", desc: "Unit aktif terdaftar" },
        { title: "Efisiensi Armada", value: `${data?.stats?.fleetKml?.toFixed(1) || 0} KM/L`, icon: Gauge, color: "bg-emerald-600", desc: "Rata-rata seluruh armada" },
        { title: "Biaya BBM", value: `Rp ${Math.round(data?.stats?.totalFuelCost || 0).toLocaleString('id-ID')}`, icon: Fuel, color: "bg-indigo-600", desc: data?.isSummary ? "Total keseluruhan" : `Bulan ${data?.period}` },
        { title: "Biaya Service", value: `Rp ${Math.round(data?.stats?.totalServiceCostYearly || 0).toLocaleString('id-ID')}`, icon: Wrench, color: "bg-orange-500", desc: `Total Tahun ${new Date().getFullYear()}` },
    ];

    const COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

    // Availability Donut Data
    const availData = [
        { name: 'Tersedia', value: data?.availability?.available || 0, color: '#10b981' },
        { name: 'Sedang Digunakan', value: data?.availability?.onTrip || 0, color: '#6366f1' },
    ];

    // Efficiency Ranking (sorted by fuel Rp/KM ascending - lowest cost = most efficient)
    const efficiencyRanking = [...(data?.vStats || [])].filter(v => v.fuelCpkm > 0).sort((a, b) => a.fuelCpkm - b.fuelCpkm);

    return (
        <div ref={dashboardRef} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
            {/* Header with Filter & Export */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3 italic">
                        <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100"><Activity size={24}/></div> DASHBOARD ARMADA
                    </h1>
                    <p className="text-slate-500 text-sm font-medium mt-1">Monitoring proaktif efisiensi dan kepatuhan unit kendaraan.</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
                        <Filter size={16} className="text-slate-400" />
                        <select 
                            className="bg-transparent text-sm font-black text-slate-700 outline-none cursor-pointer"
                            value={filter.month ? `${filter.year}-${filter.month}` : 'summary'}
                            onChange={(e) => handleFilterChange(e.target.value)}
                        >
                            <option value="summary">📊 Ringkasan Semua Bulan</option>
                            {data?.availableMonths?.map(m => (
                                <option key={m} value={m}>
                                    📅 {new Date(m + '-01').toLocaleString('id-ID', { month: 'long', year: 'numeric' })}
                                </option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={handleExportPDF}
                        disabled={exporting}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-2xl text-sm font-black uppercase tracking-tight shadow-lg shadow-indigo-200 transition-all disabled:opacity-50"
                    >
                        {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                        {exporting ? 'Mengekspor...' : 'Export PDF'}
                    </button>
                </div>
            </div>

            {/* Alerts - Always Real-time */}
            {data?.urgentActions?.length > 0 && (
                <div className="bg-white rounded-3xl border border-red-100 shadow-xl shadow-red-50/50 overflow-hidden animate-in slide-in-from-top-4 duration-700">
                    <div className="p-5 bg-gradient-to-r from-red-50 to-white flex items-center justify-between">
                        <h3 className="text-sm font-black text-red-800 flex items-center gap-2 uppercase tracking-widest">
                            <AlertCircle size={18} className="animate-bounce" /> Pusat Tindakan Segera (Urgent)
                        </h3>
                        <div className="px-3 py-1 bg-red-600 text-white text-[10px] font-black rounded-full uppercase tracking-tighter shadow-md shadow-red-200">
                            {data.urgentActions.length} Peringatan Aktif
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/50 border-b border-slate-100">
                                <tr>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit Armada</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Aksi Dibutuhkan</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Deadline / Status</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Navigasi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {data.urgentActions.map((alert, i) => (
                                    <tr key={i} className="hover:bg-red-50/10 transition-colors group">
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col">
                                                <span className="font-black text-slate-700 text-sm group-hover:text-red-700 transition-colors">{alert.vehicle}</span>
                                                <span className="text-[10px] text-slate-400 font-mono font-bold">{alert.plate}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight shadow-sm ${
                                                alert.type === 'SERVICE' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                                {alert.action}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className="text-sm font-black text-slate-600">
                                                {alert.date ? new Date(alert.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : `Odometer > ${alert.km} KM`}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6 text-right flex items-center justify-end gap-2">
                                            {['TAX', 'STNK', 'KIR'].includes(alert.type) && (
                                                <button 
                                                    onClick={() => openPayModal(alert.id, alert.type)}
                                                    className="text-xs font-black text-emerald-600 hover:text-emerald-800 bg-emerald-50 px-4 py-1.5 rounded-xl transition-all flex items-center gap-1"
                                                >
                                                    <CheckCircle2 size={14} /> TELAH BAYAR
                                                </button>
                                            )}
                                            <button className="text-xs font-black text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-4 py-1.5 rounded-xl transition-all">PROSES</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* KPI Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((s, i) => <StatCard key={i} {...s} />)}
            </div>

            {/* -------------------- BENTO ROW 1: Tren Jarak & Status Ketersediaan -------------------- */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-6">
                {/* Tren Jarak Tempuh - ALL VEHICLES (Lebar 3/4) */}
                <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 lg:col-span-3 flex flex-col">
                    <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-3 uppercase tracking-tight italic">
                        <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg"><TrendingUp size={20} /></div> Tren Jarak Tempuh Bulanan (KM)
                    </h3>
                    <div className="flex-1 min-h-[300px] max-h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data?.mileageTrends} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 'bold' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(value) => value.toLocaleString('id-ID')} />
                                <Tooltip formatter={(value) => `${value.toLocaleString('id-ID')} km`} contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px', fontWeight: 'bold' }} iconType="circle" />
                                {(data?.allVehicleNames || []).map((vName, idx) => (
                                    <Line key={vName} type="monotone" dataKey={vName} stroke={COLORS[idx % COLORS.length]} strokeWidth={4} dot={{ r: 5, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 8, strokeWidth: 0 }} animationDuration={1500} />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Donut - Ketersediaan (Sempit 1/4) */}
                <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 lg:col-span-1 flex flex-col justify-between">
                    <h3 className="text-base font-black text-slate-800 uppercase tracking-tight italic mb-4 flex items-center gap-3">
                        <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"><CheckCircle2 size={16} /></div> Ketersediaan
                    </h3>
                    <div className="flex-1 flex flex-col justify-center min-h-[200px]">
                        <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                                <Pie
                                    data={availData}
                                    cx="50%" cy="50%"
                                    innerRadius={55} outerRadius={80}
                                    dataKey="value"
                                    strokeWidth={3}
                                    stroke="#fff"
                                >
                                    {availData.map((entry, idx) => (
                                        <Cell key={idx} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(v) => `${v} Unit`} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="flex flex-col gap-3 mt-4">
                            {availData.map((d, i) => (
                                <div key={i} className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}></div>
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{d.name}</span>
                                    </div>
                                    <span className="font-black text-slate-800">{d.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* -------------------- BENTO ROW 2: Matriks Performa & Peringkat Efisiensi -------------------- */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-6">
                {/* Performance Matrix (Lebar 3/4) */}
                <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 lg:col-span-3 flex flex-col overflow-hidden">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                        <div>
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight italic flex items-center gap-3">
                                <div className="p-1.5 bg-sky-50 text-sky-600 rounded-lg"><Activity size={20} /></div> Matriks Performa
                            </h3>
                            <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest pl-10">
                                {data?.isSummary ? `Rata-Rata 30 Hari Terakhir` : `Bulan ${new Date(filter.year, filter.month-1).toLocaleString('id-ID', {month: 'long', year: 'numeric'})}`}
                            </p>
                        </div>
                    </div>
                    <div className="overflow-x-auto flex-1 custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[600px]">
                            <thead className="bg-slate-50/50">
                                <tr>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Kendaraan</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center whitespace-nowrap">Efisiensi (KM/L)</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center whitespace-nowrap">Utilisasi (%)</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center whitespace-nowrap">Cost / KM</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right whitespace-nowrap">Total Jarak</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-600">
                                {data?.vStats?.map((v, i) => (
                                    <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-black text-slate-800 text-sm whitespace-nowrap">{v.name}</span>
                                                <span className="text-[10px] text-slate-400 font-mono font-bold">{v.plate}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex flex-col items-center justify-center gap-1.5 w-full max-w-[120px] mx-auto">
                                                <span className={`text-sm font-black ${v.kml > 10 ? 'text-emerald-600' : 'text-slate-700'}`}>{v.kml?.toFixed(1) || '-'}</span>
                                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                                                    <div className={`h-full ${v.kml > 10 ? 'bg-emerald-500' : 'bg-orange-400'}`} style={{ width: `${Math.min((v.kml || 0) * 5, 100)}%` }}></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex flex-col items-center gap-1.5 w-full max-w-[120px] mx-auto">
                                                <span className="text-sm font-black text-slate-800">{v.utilization?.toFixed(0)}%</span>
                                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                                                    <div className={`h-full shadow-md ${v.utilization > 50 ? 'bg-indigo-500' : 'bg-slate-300'}`} style={{ width: `${v.utilization}%` }}></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center font-bold text-sm">
                                            <span className="bg-slate-50 border border-slate-100 px-3 py-1 rounded-lg text-slate-700 whitespace-nowrap">Rp {Math.round(v.cpkm).toLocaleString('id-ID')}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right font-black text-indigo-600 text-sm italic whitespace-nowrap">
                                            {v.totalKm?.toLocaleString('id-ID')} KM
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Peringkat Efisiensi Kendaraan (Sempit 1/4) */}
                <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 lg:col-span-1 flex flex-col">
                    <h3 className="text-base font-black text-slate-800 uppercase tracking-tight italic mb-4 flex items-center gap-3">
                        <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg"><Trophy size={16} /></div> Peringkat Biaya
                    </h3>
                    <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-2 max-h-[450px]">
                        {efficiencyRanking.map((v, i) => {
                            const maxCost = efficiencyRanking[efficiencyRanking.length - 1]?.fuelCpkm || 1;
                            const pct = maxCost > 0 ? (v.fuelCpkm / maxCost) * 100 : 0;
                            const isTop = i === 0;
                            const isBottom = i === efficiencyRanking.length - 1 && efficiencyRanking.length > 1;
                            const costVal = Math.round(v.fuelCpkm);
                            return (
                                <div key={v.id || i} className={`flex items-start gap-3 p-3 rounded-2xl transition-all ${isTop ? 'bg-emerald-50 border border-emerald-100' : isBottom ? 'bg-red-50/50 border border-red-100' : 'bg-slate-50/50 border border-slate-100 hover:bg-slate-50'}`}>
                                    <div className={`w-6 h-6 shrink-0 rounded-lg flex items-center justify-center text-xs font-black mt-0.5 ${isTop ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200' : isBottom ? 'bg-red-400 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                        {i + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-black text-slate-800 truncate pr-2">{v.name}</span>
                                            <span className={`text-[10px] font-black whitespace-nowrap ${costVal < 1000 ? 'text-emerald-600' : costVal < 3000 ? 'text-amber-600' : 'text-red-500'}`}>Rp {costVal.toLocaleString('id-ID')}</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-white/50 rounded-full overflow-hidden shadow-inner mb-1.5">
                                            <div
                                                className={`h-full rounded-full transition-all duration-1000 ${isTop ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : isBottom ? 'bg-gradient-to-r from-red-300 to-red-400' : 'bg-gradient-to-r from-slate-300 to-slate-400'}`}
                                                style={{ width: `${pct}%` }}
                                            ></div>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[9px] text-slate-400 font-mono font-bold tracking-tight">{v.plate}</span>
                                            {isTop && <span className="text-[8px] font-black text-emerald-600 bg-white/60 px-1.5 py-0.5 rounded-full uppercase">Terhemat</span>}
                                            {isBottom && <span className="text-[8px] font-black text-red-500 bg-white/60 px-1.5 py-0.5 rounded-full uppercase">Terboros</span>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {efficiencyRanking.length === 0 && (
                            <p className="text-center text-slate-400 text-xs py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">Belum ada data biaya.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* -------------------- BENTO ROW 3: Distribusi Unit, Tren Booking, Riwayat -------------------- */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-6">
                {/* Analisa Distribusi Jarak per Unit (Lebar 2/4) */}
                <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 lg:col-span-2 flex flex-col">
                    <h3 className="text-base font-black text-slate-800 mb-6 flex items-center gap-3 uppercase tracking-tight italic">
                        <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg"><Navigation2 size={16} /></div> Jarak Berdasarkan Unit
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 h-full max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
                        {data?.vStats?.filter(v => v.unitUsage?.length > 0).map(v => (
                            <div key={v.id} className="p-4 border border-slate-100 rounded-2xl bg-white shadow-sm hover:shadow-md hover:border-purple-200 transition-all flex flex-col">
                                <h4 className="font-black text-slate-800 mb-3 pb-2 border-b border-slate-100 flex items-center justify-between">
                                    <span className="flex items-center gap-2"><Car size={14} className="text-slate-400"/> <span className="text-sm truncate max-w-[100px]">{v.name}</span></span>
                                    <span className="text-[9px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">{v.plate}</span>
                                </h4>
                                <div className="space-y-2 flex-1 relative">
                                    <div className="absolute left-[7px] top-4 bottom-4 w-px bg-slate-100 -z-0"></div>
                                    {v.unitUsage.map((u, idx) => (
                                        <div key={idx} className="relative z-10 flex justify-between items-center group bg-white/50 hover:bg-slate-50 p-1.5 -mx-1.5 rounded-lg transition-colors text-xs">
                                            <div className="font-bold text-slate-600 flex items-center gap-2.5">
                                                <div className="w-4 h-4 rounded-full bg-purple-100 flex items-center justify-center border-2 border-white shadow-sm shrink-0">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                                                </div>
                                                <span className="group-hover:text-purple-700 transition-colors truncate max-w-[90px]" title={u.unit}>{u.unit}</span>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className="font-black text-indigo-600 tracking-tight">{u.distance.toLocaleString('id-ID')} <span className="text-[9px]">km</span></div>
                                                {u.fuelCost > 0 && <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Rp {Math.round(u.fuelCost).toLocaleString('id-ID')}</div>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {data?.vStats?.filter(v => v.unitUsage?.length > 0).length === 0 && (
                            <div className="col-span-full h-full flex items-center justify-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                <p className="text-center text-slate-400 text-xs py-8">Belum ada data perjalanan unit.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Tren Peminjaman (Sempit 1/4) */}
                <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 lg:col-span-1 flex flex-col">
                    <h3 className="text-base font-black text-slate-800 mb-6 uppercase tracking-tight italic flex items-center gap-2">
                        <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><Calendar size={16} /></div> Tren Sewa
                    </h3>
                    <div className="flex-1 min-h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data?.bookingTrends}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} dy={5} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#fff', borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }}
                                    cursor={{ fill: '#f8fafc' }}
                                    formatter={(v) => `${v} Perjalanan`}
                                />
                                <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={25}>
                                    {data?.bookingTrends?.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === data.bookingTrends.length - 1 ? '#4f46e5' : '#c7d2fe'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Riwayat Peminjaman Terbaru (Sempit 1/4) */}
                <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 lg:col-span-1 flex flex-col">
                    <h3 className="text-base font-black text-slate-800 mb-6 uppercase tracking-tight italic flex items-center gap-3">
                        <div className="p-1.5 bg-slate-100 text-slate-600 rounded-lg"><Clock size={16} /></div> Riwayat
                    </h3>
                    <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-1 max-h-[350px]">
                        {data?.recentBookings?.length > 0 ? data.recentBookings.map((b, i) => {
                            const statusInfo = BOOKING_STATUS_MAP[b.status] || { label: b.status, color: 'bg-slate-100 text-slate-500' };
                            return (
                                <div key={b.id || i} className="flex items-start gap-3 p-3 rounded-2xl bg-white border border-slate-100 hover:border-blue-200 hover:shadow-sm transition-all group">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2 mb-1.5">
                                            <span className="text-[11px] font-black text-slate-800 truncate group-hover:text-blue-700 transition-colors">{b.vehicle?.name || '-'}</span>
                                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase flex-shrink-0 tracking-widest ${statusInfo.color}`}>{statusInfo.label}</span>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold">
                                                <User size={10} className="text-slate-400" /> <span className="truncate">{b.user?.name || b.user?.username || '-'}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold">
                                                <MapPin size={10} className="text-slate-400" /> <span className="truncate">{b.destination || '-'}</span>
                                            </div>
                                            <div className="text-[9px] text-slate-400 font-bold pt-1 border-t border-slate-50 mt-1.5 block">
                                                {new Date(b.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        }) : (
                            <p className="text-center text-slate-400 text-xs py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">Belum ada riwayat.</p>
                        )}
                    </div>
                </div>
            </div>

{/* Modal Konfirmasi Pembayaran Pajak */}
            {payModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 text-white">
                            <h3 className="text-lg font-black flex items-center gap-2">
                                <CheckCircle2 size={22} /> Konfirmasi Pembayaran
                            </h3>
                            <p className="text-emerald-100 text-sm mt-1">{payModal.label}</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Biaya yang Dibayarkan</label>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-slate-400">Rp</span>
                                    <input
                                        type="number"
                                        value={payCost}
                                        onChange={(e) => setPayCost(e.target.value)}
                                        className="flex-1 border-2 border-slate-200 rounded-xl px-4 py-3 text-lg font-black text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                        placeholder="Masukkan nominal biaya"
                                        autoFocus
                                    />
                                </div>
                            </div>
                            {payModal.type === 'STNK' && (
                                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                                    <p className="text-xs font-bold text-blue-700">ℹ️ Karena ini pembayaran STNK (5 Tahunan), tanggal <strong>Pajak Tahunan</strong> juga akan otomatis diperpanjang 1 tahun.</p>
                                </div>
                            )}
                            <p className="text-[11px] text-slate-400">Tanggal jatuh tempo akan otomatis diperpanjang setelah dikonfirmasi.</p>
                        </div>
                        <div className="flex gap-3 p-6 pt-0">
                            <button
                                onClick={() => setPayModal(null)}
                                className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-black text-sm hover:bg-slate-50 transition-all"
                            >Batal</button>
                            <button
                                onClick={handleMarkPaid}
                                className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-sm shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2"
                            ><CheckCircle2 size={16} /> Konfirmasi Lunas</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VehicleDashboard;
