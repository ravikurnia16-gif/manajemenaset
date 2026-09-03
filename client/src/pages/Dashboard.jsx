import { useState, useEffect } from 'react';
import { Box, DollarSign, AlertTriangle, TrendingDown, Loader2, Download, CalendarRange } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
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

const StatCard = ({ title, value, icon: Icon, color, desc }) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-start justify-between">
        <div>
            <p className="text-slate-500 text-sm font-medium mb-1">{title}</p>
            <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
            {desc && <p className="text-xs text-slate-400 mt-2">{desc}</p>}
        </div>
        <div className={`p-3 rounded-lg ${color} bg-opacity-90 shadow-md`}>
            <Icon className="text-white" size={24} />
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

    const userStr = localStorage.getItem('user');
    const currentUser = userStr ? JSON.parse(userStr) : {};
    const canFilterUnit = ['SUPER_ADMIN', 'BIDANG_IT', 'ADMIN_ASET'].includes(currentUser.role);

    const fetchStats = async () => {
        try {
            setLoading(true);
            const params = filterUnit !== 'all' ? { unitId: filterUnit } : {};
            const response = await api.get('/dashboard/stats', { params });
            setData(response.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, [filterUnit]);

    if (loading && !data) return (
        <div className="flex h-96 items-center justify-center">
            <Loader2 className="animate-spin text-blue-600" size={40} />
        </div>
    );

    const stats = [
        { title: "Total Aset", value: data?.stats?.totalAssets?.toLocaleString('id-ID') || '0', icon: Box, color: "bg-blue-500", desc: "Total item terdaftar" },
        { title: "Nilai Buku (Terkini)", value: `Rp ${(data?.stats?.totalValue || 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: DollarSign, color: "bg-emerald-500", desc: "Estimasi nilai buku saat ini" },
        { title: "Aset Rusak", value: data?.stats?.damagedAssets?.toLocaleString('id-ID') || '0', icon: AlertTriangle, color: "bg-red-500", desc: "Perlu perhatian" },
        { title: "Habis Umur", value: data?.stats?.expiredAssets?.toLocaleString('id-ID') || '0', icon: TrendingDown, color: "bg-orange-500", desc: "Melewati masa manfaat" },
    ];

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

    // --- PDF EXPORT ---
    const handleExportPDF = async () => {
        if (!data) return;
        setExporting(true);
        try {
            const jsPDF = await loadJsPDF();
            const doc = new jsPDF('landscape', 'mm', 'a4');
            const pageW = doc.internal.pageSize.getWidth();
            const now = new Date();
            const unitLabel = filterUnit !== 'all' ? (data?.units?.find(u => u.id === parseInt(filterUnit))?.name || 'Unit Spesifik') : 'Seluruh Unit';

            // Header
            doc.setFontSize(18);
            doc.setFont(undefined, 'bold');
            doc.text('LAPORAN DASHBOARD MANAJEMEN ASET', pageW / 2, 18, { align: 'center' });
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.text(`Unit: ${unitLabel}  |  Tanggal Cetak: ${now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, pageW / 2, 25, { align: 'center' });

            // KPI Summary
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text('Ringkasan KPI Aset', 14, 35);
            doc.autoTable({
                startY: 38,
                head: [['Total Aset', 'Nilai Buku (Rp)', 'Aset Rusak', 'Habis Umur']],
                body: [[
                    (data.stats.totalAssets || 0).toLocaleString('id-ID'),
                    `Rp ${(data.stats.totalValue || 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                    (data.stats.damagedAssets || 0).toLocaleString('id-ID'),
                    (data.stats.expiredAssets || 0).toLocaleString('id-ID')
                ]],
                theme: 'grid',
                headStyles: { fillColor: [59, 130, 246], fontSize: 9, fontStyle: 'bold' },
                bodyStyles: { fontSize: 10, fontStyle: 'bold' },
                margin: { left: 14, right: 14 }
            });

            // Procurement Data
            if (data.chartData?.length > 0) {
                doc.setFontSize(12);
                doc.setFont(undefined, 'bold');
                doc.text('Analisa Pengadaan Aset (Per Kategori)', 14, doc.lastAutoTable.finalY + 10);
                doc.autoTable({
                    startY: doc.lastAutoTable.finalY + 13,
                    head: [['Kategori', 'Jumlah Unit', 'Nilai (Rp)']],
                    body: (data.chartData || []).map((d, i) => [
                        d.name,
                        d.value.toLocaleString('id-ID'),
                        data.spendingData?.[i]?.value ? `Rp ${data.spendingData[i].value.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'
                    ]),
                    theme: 'striped',
                    headStyles: { fillColor: [99, 102, 241], fontSize: 8, fontStyle: 'bold' },
                    bodyStyles: { fontSize: 8 },
                    margin: { left: 14, right: 14 }
                });
            }

            // Maintenance Statistics
            if (data.maintenanceData?.length > 0) {
                const mtTotal = data.maintenanceData.reduce((sum, item) => sum + item.value, 0);
                const mtCompleted = data.maintenanceData.find(d => d.name === 'COMPLETED')?.value || 0;
                const mtPercent = mtTotal > 0 ? Math.round((mtCompleted / mtTotal) * 100) : 0;

                doc.setFontSize(12);
                doc.setFont(undefined, 'bold');
                doc.text(`Statistik Pemeliharaan (Ketercapaian: ${mtPercent}%)`, 14, doc.lastAutoTable.finalY + 10);
                doc.autoTable({
                    startY: doc.lastAutoTable.finalY + 13,
                    head: [['Status', 'Jumlah']],
                    body: data.maintenanceData.map(d => [d.name, d.value]),
                    theme: 'striped',
                    headStyles: { fillColor: [16, 185, 129], fontSize: 8, fontStyle: 'bold' },
                    bodyStyles: { fontSize: 8 },
                    margin: { left: 14, right: 14 }
                });
            }

            // Unit Statistics
            if (data.unitStats?.length > 0) {
                doc.addPage();
                doc.setFontSize(12);
                doc.setFont(undefined, 'bold');
                doc.text('Sebaran Aset per Unit', 14, 18);
                doc.autoTable({
                    startY: 22,
                    head: [['Unit', 'Kode', 'Total Item', 'Rusak', 'Nilai Buku (Rp)']],
                    body: data.unitStats.map(u => [
                        u.name, u.code, u.assetCount.toLocaleString('id-ID'), u.damagedCount.toLocaleString('id-ID'),
                        `Rp ${u.totalValue.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    ]),
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

            doc.save(`Laporan_Aset_${unitLabel.replace(/[/ ]/g, '_')}_${now.toISOString().slice(0, 10)}.pdf`);
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
                    <h1 className="text-2xl font-bold text-slate-800">Dashboard Manajemen Aset</h1>
                    <p className="text-slate-500 text-sm italic">
                        {activeTab === 'weekly'
                            ? 'Laporan pergerakan, pengadaan, mutasi, pemeliharaan, dan verifikasi aset berkala'
                            : (filterUnit !== 'all'
                                ? `Menampilkan data untuk: ${data?.units?.find(u => u.id === parseInt(filterUnit))?.name || 'Unit Spesifik'}`
                                : 'Ringkasan statistik aset seluruh perusahaan')}
                    </p>
                </div>

                {activeTab === 'overview' && (
                    <div className="flex flex-wrap items-center gap-3">
                        {canFilterUnit && (
                            <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-100 shadow-sm">
                                <span className="text-xs font-bold text-slate-400 ml-2 uppercase">Filter Unit:</span>
                                <select
                                    value={filterUnit}
                                    onChange={(e) => setFilterUnit(e.target.value)}
                                    className="text-sm border-none bg-transparent focus:ring-0 text-slate-700 font-semibold cursor-pointer"
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
                                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 transition-all"
                            >
                                Scan NFC Aset
                            </button>
                        )}
                        <button
                            onClick={handleExportPDF}
                            disabled={exporting}
                            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-slate-200 transition-all disabled:opacity-50"
                        >
                            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                            {exporting ? 'Mengekspor...' : 'Export PDF'}
                        </button>
                    </div>
                )}
            </div>

            {/* TAB SWITCHER */}
            <div className="flex items-center gap-2 p-1.5 bg-slate-100/90 rounded-2xl w-fit border border-slate-200/80 shadow-inner print:hidden">
                <button
                    onClick={() => setActiveTab('overview')}
                    className={cn(
                        "flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all",
                        activeTab === 'overview'
                            ? "bg-white text-slate-800 shadow-sm"
                            : "text-slate-500 hover:text-slate-800"
                    )}
                >
                    <Box size={16} className={activeTab === 'overview' ? "text-blue-600" : ""} />
                    Ikhtisar Kumulatif
                </button>
                <button
                    onClick={() => setActiveTab('weekly')}
                    className={cn(
                        "flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all relative",
                        activeTab === 'weekly'
                            ? "bg-white text-slate-800 shadow-sm"
                            : "text-slate-500 hover:text-slate-800"
                    )}
                >
                    <CalendarRange size={16} className={activeTab === 'weekly' ? "text-indigo-600" : ""} />
                    Laporan Mingguan & Operasional
                    <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-700 rounded-full">
                        Laporan
                    </span>
                </button>
            </div>

            {/* TAB CONTENT */}
            {activeTab === 'weekly' ? (
                <WeeklyAssetReport currentUser={currentUser} />
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {stats.map((s, i) => <StatCard key={i} {...s} />)}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* 1. Pengadaan & Spending */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-slate-800">Analisa Pengadaan Aset</h3>
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                            <button
                                onClick={() => setChartMode('count')}
                                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${chartMode === 'count' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                            >
                                JUMLAH
                            </button>
                            <button
                                onClick={() => setChartMode('spending')}
                                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${chartMode === 'spending' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                            >
                                NILAI (RP)
                            </button>
                        </div>
                    </div>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <BarChart data={chartMode === 'count' ? data?.chartData : data?.spendingData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} dy={10} />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 10 }}
                                    tickFormatter={(val) => chartMode === 'spending' ? `${(val / 1000000).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}jt` : val.toLocaleString('id-ID')}
                                />
                                <Tooltip
                                    formatter={(val) => chartMode === 'spending' ? `Rp ${val.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `${val.toLocaleString('id-ID')} Unit`}
                                    contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    cursor={{ fill: '#f8fafc' }}
                                />
                                <Bar dataKey="value" fill={chartMode === 'count' ? "#3b82f6" : "#10b981"} radius={[6, 6, 0, 0]} barSize={35} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Komposisi Kategori */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Komposisi Kategori</h3>
                    <div className="h-72 flex justify-center items-center">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <PieChart>
                                <Pie
                                    data={data?.pieData || []}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {(data?.pieData || []).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-4 mt-2 flex-wrap max-h-20 overflow-y-auto custom-scrollbar p-2">
                        {(data?.pieData || []).map((entry, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{entry.name}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 3. Statistik Pemeliharaan */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">Statistik Pemeliharaan</h3>
                            <p className="text-xs text-slate-400 font-medium">Distribusi status perbaikan aset sarpras</p>
                        </div>
                        {/* Maintenance KPI Percentage */}
                        {(() => {
                            const mtTotal = data?.maintenanceData?.reduce((sum, item) => sum + item.value, 0) || 0;
                            const mtCompleted = data?.maintenanceData?.find(d => d.name === 'COMPLETED')?.value || 0;
                            const mtPercent = mtTotal > 0 ? Math.round((mtCompleted / mtTotal) * 100) : 0;
                            return (
                                <div className="flex items-center gap-3 bg-green-50 px-4 py-2 rounded-xl border border-green-100">
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Ketercapaian</p>
                                        <p className="text-xl font-black text-green-700">{mtPercent}%</p>
                                    </div>
                                    <div className="w-10 h-10 rounded-full border-4 border-green-100 border-t-green-500 animate-in spin-in-180 duration-1000 flex items-center justify-center">
                                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                    </div>
                                </div>
                            );
                        })()}
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
                        <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-4">
                            {(data?.maintenanceData || []).map((item, idx) => {
                                const colorMap = {
                                    'SUBMITTED': 'bg-slate-100 text-slate-600',
                                    'APPROVED': 'bg-sky-100 text-sky-700',
                                    'VALIDATED': 'bg-indigo-100 text-indigo-700',
                                    'ASSIGNED': 'bg-amber-100 text-amber-700',
                                    'IN_PROGRESS': 'bg-orange-100 text-orange-700',
                                    'COMPLETED': 'bg-green-100 text-green-700',
                                    'REJECTED': 'bg-red-100 text-red-700'
                                };
                                return (
                                    <div key={idx} className={`p-4 rounded-xl border border-transparent hover:border-slate-100 transition-all ${colorMap[item.name] || 'bg-slate-50'}`}>
                                        <div className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">{item.name}</div>
                                        <div className="text-xl font-black">{item.value.toLocaleString('id-ID')}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Unit Statistics Table - Only show if not specifically filtering one unit and data exists */}
            {canFilterUnit && filterUnit === 'all' && data?.unitStats?.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden animate-in zoom-in-95 duration-300">
                    <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-white">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <Box className="text-blue-600" size={20} /> Sebaran Aset per Unit
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/50">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Unit / Satker</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Total Item</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Rusak Ringan/Berat</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Nilai Buku</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {data.unitStats.map((unit) => (
                                    <tr key={unit.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-700 text-sm">{unit.name}</span>
                                                <span className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">{unit.code}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700">
                                                {unit.assetCount.toLocaleString('id-ID')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${unit.damagedCount > 0 ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-400'}`}>
                                                {unit.damagedCount.toLocaleString('id-ID')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="font-bold text-slate-600 text-sm">
                                                Rp {unit.totalValue.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
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
