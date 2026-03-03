import { useState, useEffect } from 'react';
import {
    FileText,
    Box,
    Warehouse,
    Users,
    TrendingDown,
    Download,
    Filter,
    Calendar,
    ChevronRight,
    Search,
    RefreshCw,
    ArrowUpRight,
    ArrowDownRight,
    AlertCircle,
    BarChart3,
    PieChart as PieChartIcon,
    Table as TableIcon,
    Loader2
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import api from '../lib/axios';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

const StatCard = ({ title, value, icon: Icon, color, trend, trendValue }) => (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-4">
            <div className={`p-2.5 rounded-xl ${color} bg-opacity-10 text-${color.replace('bg-', '')}`}>
                <Icon size={20} />
            </div>
            {trend && (
                <div className={`flex items-center gap-1 text-xs font-bold ${trend === 'up' ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    {trendValue}
                </div>
            )}
        </div>
        <div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">{title}</p>
            <h3 className="text-2xl font-black text-slate-800">{value}</h3>
        </div>
    </div>
);

const ReportPage = () => {
    const [activeTab, setActiveTab] = useState('aset');
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [filterUnit, setFilterUnit] = useState('all');
    const [assetList, setAssetList] = useState([]);

    const user = JSON.parse(localStorage.getItem('user')) || {};
    const isAdmin = ['SUPER_ADMIN', 'ADMIN_ASET', 'BIDANG_IT'].includes(user.role);

    useEffect(() => {
        fetchReportData();
    }, [activeTab, filterUnit, dateRange]);

    const fetchReportData = async () => {
        try {
            setLoading(true);
            const params = {
                unitId: filterUnit !== 'all' ? filterUnit : undefined,
                startDate: dateRange.start || undefined,
                endDate: dateRange.end || undefined
            };

            // Multiplexing data fetching based on tab
            let res;
            if (activeTab === 'aset' || activeTab === 'depresiasi') {
                res = await api.get('/dashboard/stats', { params });
                setData(res.data);

                // Fetch full asset list for detailed reports
                const assetRes = await api.get('/assets', { params: { ...params, limit: 1000 } });
                setAssetList(assetRes.data.assets || []);
            } else if (activeTab === 'gudang') {
                res = await api.get('/warehouse/dashboard', { params });
                setData(res.data);
            } else if (activeTab === 'personalia') {
                res = await api.get('/personnel/reports', { params: { ...params, limit: 50, type: 'DAILY' } });
                setData(res.data);
            }
        } catch (err) {
            console.error('Report Fetch Error:', err);
        } finally {
            setLoading(false);
        }
    };

    const exportToCSV = (data, filename) => {
        if (!data || data.length === 0) return;
        const headers = Object.keys(data[0]).join(',');
        const rows = data.map(row =>
            Object.values(row).map(val => `"${val}"`).join(',')
        ).join('\n');

        const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows;
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${filename}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExport = () => {
        if (activeTab === 'aset') {
            const exportData = assetList.map(a => ({
                Kode: a.code,
                Nama: a.name,
                Kategori: a.category?.name,
                Unit: a.unit?.name,
                Kondisi: a.condition,
                Harga: a.price,
                Tanggal_Beli: new Date(a.purchaseDate).toLocaleDateString('id-ID')
            }));
            exportToCSV(exportData, `Laporan_Aset_${new Date().toISOString().split('T')[0]}`);
        } else if (activeTab === 'depresiasi') {
            const exportData = assetList.map(a => {
                const now = new Date();
                const purchaseDate = new Date(a.purchaseDate);
                const monthsElapsed = (now.getFullYear() - purchaseDate.getFullYear()) * 12 + (now.getMonth() - purchaseDate.getMonth());
                const totalMonths = (a.usefulLife || 5) * 12;
                const monthlyDepreciation = a.price / totalMonths;
                const accumulatedDepreciation = Math.min(a.price, monthlyDepreciation * Math.max(0, monthsElapsed));
                const bookValue = Math.max(0, a.price - accumulatedDepreciation);

                return {
                    Kode: a.code,
                    Nama: a.name,
                    Harga_Perolehan: a.price,
                    Masa_Manfaat: a.usefulLife,
                    Akumulasi_Penyusutan: Math.round(accumulatedDepreciation),
                    Nilai_Buku: Math.round(bookValue)
                };
            });
            exportToCSV(exportData, `Laporan_Penyusutan_${new Date().toISOString().split('T')[0]}`);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                        <BarChart3 className="text-blue-600" /> Pusat Laporan Terpadu
                    </h1>
                    <p className="text-slate-500 text-sm font-medium">Konsolidasi data manajemen sarana dan prasarana</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                    >
                        <Download size={18} /> Export CSV
                    </button>
                    <button
                        onClick={fetchReportData}
                        className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all"
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Global Filters */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">Unit Kerja</label>
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <select
                            value={filterUnit}
                            onChange={e => setFilterUnit(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                        >
                            <option value="all">Seluruh Unit</option>
                            {isAdmin && data?.units?.map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="flex gap-2 min-w-[300px]">
                    <div className="flex-1">
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">Mulai Tanggal</label>
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
                            className="w-full p-2 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">Sampai Tanggal</label>
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
                            className="w-full p-2 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-fit overflow-x-auto no-scrollbar">
                {[
                    { id: 'aset', label: 'Inventaris Aset', icon: Box },
                    { id: 'depresiasi', label: 'Penyusutan & Nilai Buku', icon: TrendingDown },
                    { id: 'gudang', label: 'Logistik & Gudang', icon: Warehouse },
                    { id: 'personalia', label: 'Aktivitas SDM', icon: Users }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${activeTab === tab.id
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-slate-500 hover:bg-slate-200'
                            }`}
                    >
                        <tab.icon size={14} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="h-96 flex flex-col items-center justify-center gap-4 bg-white rounded-3xl border border-slate-100 italic text-slate-400">
                    <Loader2 className="animate-spin text-blue-600" size={40} />
                    Menyusun laporan, mohon tunggu...
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Tab Content: Aset */}
                    {activeTab === 'aset' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <StatCard title="Total Aset Terdaftar" value={data?.stats?.totalAssets || 0} icon={Box} color="bg-blue-500" />
                                <StatCard title="Total Nilai Perolehan" value={`Rp ${(assetList.reduce((s, a) => s + a.price, 0)).toLocaleString()}`} icon={Download} color="bg-emerald-500" />
                                <StatCard title="Kondisi Rusak" value={data?.stats?.damagedAssets || 0} icon={AlertCircle} color="bg-rose-500" trend="down" trendValue="2% vs bln lalu" />
                                <StatCard title="Habis Masa Manfaat" value={data?.stats?.expiredAssets || 0} icon={TrendingDown} color="bg-amber-500" />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                                    <h3 className="text-sm font-black text-slate-800 mb-6 uppercase tracking-wider flex items-center gap-2">
                                        <PieChartIcon size={18} className="text-blue-600" /> Komposisi Kategori
                                    </h3>
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={data?.pieData || []}
                                                    cx="50%" cy="50%"
                                                    innerRadius={60} outerRadius={90}
                                                    paddingAngle={5} dataKey="value"
                                                >
                                                    {(data?.pieData || []).map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="mt-4 grid grid-cols-2 gap-2">
                                        {(data?.pieData || []).map((entry, index) => (
                                            <div key={index} className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl">
                                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                                <span className="text-[10px] font-bold text-slate-600 truncate uppercase">{entry.name}</span>
                                                <span className="text-xs font-black text-slate-900 ml-auto">{entry.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                                    <h3 className="text-sm font-black text-slate-800 mb-6 uppercase tracking-wider flex items-center gap-2">
                                        <TableIcon size={18} className="text-blue-600" /> Aset Terbaru & Sebaran
                                    </h3>
                                    <div className="space-y-4">
                                        {assetList.slice(0, 5).map((asset, i) => (
                                            <div key={i} className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded-2xl transition-all border border-transparent hover:border-slate-100">
                                                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-400 text-xs">
                                                    {i + 1}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="text-sm font-bold text-slate-800 truncate">{asset.name}</div>
                                                    <div className="text-[10px] text-slate-400 font-bold uppercase">{asset.code} • {asset.unit?.name}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs font-black text-blue-600">Rp {asset.price.toLocaleString()}</div>
                                                    <div className="text-[9px] font-bold text-slate-400 uppercase">{new Date(asset.purchaseDate).toLocaleDateString()}</div>
                                                </div>
                                            </div>
                                        ))}
                                        <button className="w-full py-3 text-xs font-bold text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all uppercase tracking-widest border border-dashed border-slate-200">
                                            Lihat Selengkapnya
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab Content: Depresiasi */}
                    {activeTab === 'depresiasi' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
                            <TrendingDown size={48} className="mx-auto text-slate-300 mb-4" />
                            <h3 className="text-lg font-bold text-slate-800">Laporan Penyusutan (Linear)</h3>
                            <p className="text-slate-500 max-w-md mx-auto text-sm">Bagian ini akan menyajikan rekapitulasi nilai buku per kategori dan proyeksi penyusutan asset untuk tahun berjalan.</p>
                            <div className="mt-6 flex justify-center gap-4">
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 w-48">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Total Nilai Buku</div>
                                    <div className="text-xl font-black text-blue-600">Rp {(data?.stats?.totalValue || 0).toLocaleString()}</div>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 w-48">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Akumulasi Susut</div>
                                    <div className="text-xl font-black text-rose-600">Rp {(assetList.reduce((s, a) => s + a.price, 0) - (data?.stats?.totalValue || 0)).toLocaleString()}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab Content: Gudang */}
                    {activeTab === 'gudang' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <StatCard title="Varian Barang" value={data?.totalItems || 0} icon={Box} color="bg-blue-500" />
                                <StatCard title="Stok Kritis" value={data?.lowStockCount || 0} icon={AlertCircle} color="bg-rose-500" />
                                <StatCard title="Transaksi Laporan" value={data?.txThisMonth || 0} icon={ArrowLeftRight} color="bg-emerald-500" />
                            </div>
                            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                                <h3 className="text-sm font-black text-slate-800 mb-6 uppercase tracking-wider">Persediaan per Kategori</h3>
                                <div className="h-72">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={data?.stockByCategory || []}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} />
                                            <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                                            <Bar dataKey="total" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab Content: Personalia */}
                    {activeTab === 'personalia' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm text-center">
                                <Users size={40} className="mx-auto text-purple-500 mb-4" />
                                <h3 className="text-lg font-bold text-slate-800">Aggregator Aktivitas Staff</h3>
                                <p className="text-slate-500 text-sm mb-6">Konsolidasi laporan harian dari seluruh staff sarpras dalam rentang waktu tertentu.</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                                    {(Array.isArray(data) ? data : []).slice(0, 6).map((report, i) => (
                                        <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold text-sm">
                                                {report.user?.name?.[0] || 'S'}
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-slate-800">{report.user?.name}</div>
                                                <div className="text-[10px] text-slate-400 font-bold uppercase">{new Date(report.date).toLocaleDateString('id-ID')}</div>
                                            </div>
                                            <div className="ml-auto flex flex-col items-end">
                                                <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-black">HARIAN</span>
                                                <span className="text-[9px] text-slate-400 mt-1">{report.metadata?.startTime} - {report.metadata?.endTime}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button className="mt-8 px-6 py-3 bg-slate-800 text-white rounded-2xl font-bold text-sm hover:bg-slate-700 transition-all">
                                    Buka Panel Analisa AI Terpusat
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ReportPage;
