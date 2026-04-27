import { useState, useEffect } from 'react';
import { Warehouse, Package, ArrowDownCircle, ArrowUpCircle, AlertTriangle, Loader2, Receipt, History, ShoppingBag, TrendingUp, User, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
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

const StatCard = ({ label, value, icon, color, subValue }) => (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
        <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 bg-gradient-to-br ${color} opacity-5 rounded-full group-hover:scale-110 transition-transform duration-500`}></div>
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-white mb-4 shadow-sm`}>
            {icon}
        </div>
        <div className="text-2xl font-black text-slate-800 tracking-tight">{value}</div>
        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{label}</div>
        {subValue && <div className="text-[10px] font-bold text-slate-500 mt-2 bg-slate-50 px-2 py-0.5 rounded-full inline-block">{subValue}</div>}
    </div>
);

const WarehouseDashboard = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        api.get('/warehouse/dashboard')
            .then(r => { setData(r.data); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    if (loading) return (
        <div className="flex h-96 items-center justify-center">
            <Loader2 className="animate-spin text-indigo-600" size={40} />
        </div>
    );

    if (!data) return <div className="p-10 text-center text-slate-400 font-bold">Gagal memuat data dashboard gudang ustadz.</div>;

    const cards = [
        { label: 'Total Aset (Nilai)', value: `Rp ${data.totalValuation?.toLocaleString('id-ID')}`, icon: <TrendingUp size={24} />, color: 'from-emerald-500 to-teal-500', subValue: `${data.totalItems} Jenis Barang` },
        { label: 'Total Stok Fisik', value: data.totalStock?.toLocaleString('id-ID'), icon: <Warehouse size={24} />, color: 'from-indigo-500 to-purple-500' },
        { label: 'Pesanan Pending', value: data.orderStats?.PENDING || 0, icon: <ShoppingBag size={24} />, color: 'from-blue-500 to-cyan-500', subValue: `Nilai: Rp ${data.orderStats?.totalPendingValue?.toLocaleString('id-ID')}` },
        { label: 'Masuk (Bulan Ini)', value: data.txInThisMonth, icon: <ArrowDownCircle size={24} />, color: 'from-blue-500 to-indigo-500' },
        { label: 'Keluar (Bulan Ini)', value: data.txOutThisMonth, icon: <ArrowUpCircle size={24} />, color: 'from-orange-500 to-amber-500' },
    ];

    // --- PDF EXPORT ---
    const handleExportPDF = async () => {
        if (!data) return;
        setExporting(true);
        try {
            const jsPDF = await loadJsPDF();
            const doc = new jsPDF('landscape', 'mm', 'a4');
            const pageW = doc.internal.pageSize.getWidth();
            const now = new Date();

            // Header
            doc.setFontSize(18);
            doc.setFont(undefined, 'bold');
            doc.text('LAPORAN DASHBOARD LOGISTIK', pageW / 2, 18, { align: 'center' });
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.text(`Tanggal Cetak: ${now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, pageW / 2, 25, { align: 'center' });

            // KPI Summary
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text('Ringkasan KPI Logistik', 14, 35);
            doc.autoTable({
                startY: 38,
                head: [['Total Nilai Aset', 'Jenis Barang', 'Total Stok', 'Pesanan Pending', 'Masuk (Bln Ini)', 'Keluar (Bln Ini)', 'Stok Rendah']],
                body: [[
                    `Rp ${(data.totalValuation || 0).toLocaleString('id-ID')}`,
                    data.totalItems || 0,
                    (data.totalStock || 0).toLocaleString('id-ID'),
                    data.orderStats?.PENDING || 0,
                    data.txInThisMonth || 0,
                    data.txOutThisMonth || 0,
                    data.lowStockCount || 0
                ]],
                theme: 'grid',
                headStyles: { fillColor: [99, 102, 241], fontSize: 8, fontStyle: 'bold' },
                bodyStyles: { fontSize: 9, fontStyle: 'bold' },
                margin: { left: 14, right: 14 }
            });

            // Stock by Category
            if (data.stockByCategory?.length > 0) {
                doc.setFontSize(12);
                doc.setFont(undefined, 'bold');
                doc.text('Valuasi Stok per Kategori', 14, doc.lastAutoTable.finalY + 10);
                doc.autoTable({
                    startY: doc.lastAutoTable.finalY + 13,
                    head: [['Kategori', 'Valuasi (Rp)']],
                    body: data.stockByCategory.map(c => [c.name, `Rp ${(c.value || 0).toLocaleString('id-ID')}`]),
                    theme: 'striped',
                    headStyles: { fillColor: [99, 102, 241], fontSize: 8, fontStyle: 'bold' },
                    bodyStyles: { fontSize: 8 },
                    margin: { left: 14, right: 14 }
                });
            }

            // Order Status Breakdown
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text('Status Pesanan Unit', 14, doc.lastAutoTable.finalY + 10);
            doc.autoTable({
                startY: doc.lastAutoTable.finalY + 13,
                head: [['Status', 'Jumlah']],
                body: [
                    ['Dalam Proses (Pending)', data.orderStats?.PENDING || 0],
                    ['Siap Diambil (Ready)', data.orderStats?.READY || 0],
                    ['Selesai (Done)', (data.orderStats?.PICKED_UP || 0) + (data.orderStats?.DONE || 0)],
                    ['Total Pesanan', data.orderStats?.total || 0],
                ],
                theme: 'striped',
                headStyles: { fillColor: [16, 185, 129], fontSize: 8, fontStyle: 'bold' },
                bodyStyles: { fontSize: 8 },
                margin: { left: 14, right: 14 }
            });

            // Low Stock Watchlist
            if (data.lowStockItems?.length > 0) {
                doc.addPage();
                doc.setFontSize(12);
                doc.setFont(undefined, 'bold');
                doc.text(`Daftar Stok Rendah (${data.lowStockItems.length} Item)`, 14, 18);
                doc.autoTable({
                    startY: 22,
                    head: [['#', 'Nama Barang', 'Kategori', 'Stok Saat Ini', 'Stok Minimum', 'Status']],
                    body: data.lowStockItems.map((item, i) => [
                        i + 1, item.name, item.category || '-',
                        item.stock, item.minStock,
                        item.stock <= 0 ? '\u26a0\ufe0f HABIS' : '\u26a0\ufe0f RENDAH'
                    ]),
                    theme: 'striped',
                    headStyles: { fillColor: [239, 68, 68], fontSize: 8, fontStyle: 'bold' },
                    bodyStyles: { fontSize: 8 },
                    margin: { left: 14, right: 14 }
                });
            }

            // Recent Transactions
            if (data.recentTransactions?.length > 0) {
                doc.setFontSize(12);
                doc.setFont(undefined, 'bold');
                doc.text('Log Aktivitas Gudang Terbaru', 14, doc.lastAutoTable.finalY + 10);
                doc.autoTable({
                    startY: doc.lastAutoTable.finalY + 13,
                    head: [['Tipe', 'Barang', 'Tanggal', 'Petugas']],
                    body: data.recentTransactions.map(tx => [
                        tx.type === 'IN' ? 'Masuk' : 'Keluar',
                        tx.items?.map(it => `${it.item?.name} (${it.quantity})`).join(', ') || '-',
                        new Date(tx.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
                        tx.createdBy?.name || '-'
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

            doc.save(`Laporan_Logistik_${now.toISOString().slice(0, 10)}.pdf`);
        } catch (err) {
            console.error('PDF Export Error:', err);
            alert('Gagal mengekspor PDF: ' + err.message);
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                        <div className="p-2 bg-indigo-600 text-white rounded-xl"><Warehouse size={24}/></div> Dashboard Logistik
                    </h1>
                    <p className="text-sm text-slate-500 mt-1 font-medium">Monitoring ketersediaan kain, seragam, dan logistik operasional.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-3 bg-red-50 px-4 py-2 rounded-2xl border border-red-100 animate-pulse">
                        <AlertTriangle className="text-red-500" size={18} />
                        <span className="text-xs font-black text-red-700 uppercase tracking-wider">{data.lowStockCount} Item Stok Rendah</span>
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

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
                {cards.map((c, i) => <StatCard key={i} {...c} />)}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Chart Section */}
                <div className="xl:col-span-2 space-y-6">
                    <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">
                        <h3 className="text-lg font-black text-slate-800 mb-8 flex items-center gap-2 uppercase tracking-tight">
                            <History className="text-indigo-600" size={20} /> Valuasi Stok per Kategori
                        </h3>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.stockByCategory}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 'bold' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                                    <Tooltip
                                        cursor={{ fill: '#f8fafc' }}
                                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={45}>
                                        {data.stockByCategory.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#6366f1' : '#8b5cf6'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Recent Activity Log */}
                    <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                <History className="text-blue-600" size={20} /> Log Aktivitas Gudang
                            </h3>
                            <button className="text-[10px] font-black text-blue-600 hover:underline">LIHAT SEMUA</button>
                        </div>
                        <div className="space-y-4">
                            {data.recentTransactions?.map((tx, i) => (
                                <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-transparent hover:border-slate-200 transition-all">
                                    <div className={`p-3 rounded-full ${tx.type === 'IN' ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'}`}>
                                        {tx.type === 'IN' ? <ArrowDownCircle size={20} /> : <ArrowUpCircle size={20} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-black text-slate-800 uppercase tracking-tight">
                                            {tx.type === 'IN' ? 'Barang Masuk' : 'Pengambilan Barang'}
                                        </div>
                                        <div className="text-[11px] text-slate-500 font-medium truncate">
                                            {tx.items.map(it => `${it.item.name} (${it.quantity})`).join(', ')}
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="text-[10px] font-black text-slate-400 mb-1">{new Date(tx.date).toLocaleDateString('id-ID')}</div>
                                        <div className="flex items-center gap-1.5 justify-end text-[10px] font-bold text-slate-600">
                                            <User size={10} /> {tx.createdBy?.name || 'User'}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Sidebar Stats */}
                <div className="space-y-6">
                    {/* Order Breakdown */}
                    <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm bg-gradient-to-b from-white to-slate-50/50">
                        <h3 className="text-lg font-black text-slate-800 mb-6 uppercase tracking-tight flex items-center gap-2">
                            <Receipt className="text-cyan-600" size={20} /> Status Pesanan
                        </h3>
                        <div className="grid grid-cols-1 gap-3">
                            <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex justify-between items-center">
                                <span className="text-xs font-bold text-amber-700">Dalam Proses</span>
                                <span className="text-xl font-black text-amber-800">{data.orderStats?.PENDING || 0}</span>
                            </div>
                            <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex justify-between items-center">
                                <span className="text-xs font-bold text-blue-700">Siap Diambil</span>
                                <span className="text-xl font-black text-blue-800">{data.orderStats?.READY || 0}</span>
                            </div>
                            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex justify-between items-center">
                                <span className="text-xs font-bold text-emerald-700">Selesai (Done)</span>
                                <span className="text-xl font-black text-emerald-800">{(data.orderStats?.PICKED_UP || 0) + (data.orderStats?.DONE || 0)}</span>
                            </div>
                        </div>
                        <div className="mt-6 pt-6 border-t border-slate-200">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Pesanan</span>
                                <span className="text-lg font-black text-indigo-600">{data.orderStats?.total || 0}</span>
                            </div>
                        </div>
                    </div>

                    {/* Low Stock Watchlist */}
                    <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-black text-slate-800 tracking-tight uppercase">STOK RENDAH</h3>
                            <button className="text-[10px] font-black text-red-500 bg-red-50 px-3 py-1 rounded-full">{data.lowStockItems?.length || 0} ITEM</button>
                        </div>
                        <div className="space-y-3">
                            {data.lowStockItems?.map((item, i) => (
                                <div key={i} className="group p-4 bg-slate-50 rounded-2xl border border-transparent hover:border-red-100 hover:bg-red-50/50 transition-all flex items-center gap-4">
                                    {item.image ? (
                                        <img src={item.image} alt={item.name} className="w-12 h-12 rounded-xl object-cover border border-slate-200" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-xl bg-slate-200 flex items-center justify-center text-slate-400">
                                            <Package size={18} />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-black text-slate-800 group-hover:text-red-700 truncate">{item.name}</div>
                                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{item.category?.name || item.category}</div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="text-lg font-black text-red-600">{item.stock}</div>
                                        <div className="text-[9px] font-bold text-slate-400 uppercase">MIN: {item.minStock}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WarehouseDashboard;
