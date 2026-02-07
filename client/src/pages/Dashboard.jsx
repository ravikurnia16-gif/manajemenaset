import { useState, useEffect } from 'react';
import { Box, DollarSign, AlertTriangle, TrendingDown, Loader2, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import api from '../lib/axios';
import * as XLSX from 'xlsx';

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
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await api.get('/dashboard/stats');
                setData(response.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const handleDownloadReport = async () => {
        try {
            setDownloading(true);
            const response = await api.get('/assets');
            const allAssets = response.data;
            const now = new Date();

            const exportData = allAssets.map((a, index) => {
                const purchaseDate = new Date(a.purchaseDate);
                const monthsElapsed = Math.max(0, (now.getFullYear() - purchaseDate.getFullYear()) * 12 + (now.getMonth() - purchaseDate.getMonth()));
                const totalMonths = (a.usefulLife || 5) * 12;
                const monthlyDepreciation = Math.round(a.price / totalMonths);
                const accumulatedDepreciation = Math.min(a.price, monthlyDepreciation * monthsElapsed);
                const bookValue = Math.max(0, a.price - accumulatedDepreciation);

                // Days calculation
                const msPerDay = 24 * 60 * 60 * 1000;
                const daysElapsed = Math.max(0, Math.floor((now - purchaseDate) / msPerDay));

                return {
                    'No': index + 1,
                    'Kode': a.code,
                    'Nama': a.name,
                    'Merek': a.brand || '-',
                    'Vendor': a.vendor?.name || '-',
                    'Tanggal Perolehan': a.purchaseDate ? new Date(a.purchaseDate).toLocaleDateString('id-ID') : '-',
                    'Status Perolehan': 'Beli Baru',
                    'Harga Perolehan': a.price,
                    'Kategori': a.category?.name || '-',
                    'Sumber Dana': a.sourceOfFunds || 'Mandiri',
                    'Kondisi': a.condition,
                    'Nama Ruangan': a.room?.name || '-',
                    'Lokasi': a.room?.building || '-',
                    'Nama Unit/Bidang': a.unit?.name || '-',
                    'Penjual/Penghibah': a.vendor?.name || '-',
                    'Umur Ekonomis': a.usefulLife + ' Tahun',
                    'Nilai Penyusutan per Bulan': monthlyDepreciation,
                    'Jumlah Bulan Penyusutan': Math.min(monthsElapsed, totalMonths),
                    'Jurnal Penyusutan (Bulanan)': `D: Beban Penyusutan / K: Akum. Penyusutan (${monthlyDepreciation})`,
                    'Jumlah Nominal Penyusutan Terkini': accumulatedDepreciation,
                    'Perkiraan Hari Penyusutan Terkini': daysElapsed,
                    'Jumlah Hari Penyusutan Terkini': daysElapsed,
                    'Nilai Buku': bookValue,
                    'Tanggal PHPP': '-',
                    'Hari Penyusutan Sebelum PHPP': '-',
                    'Nilai Penyusutan Saat PHPP': '-',
                    'Nilai Buku Saat PHPP': '-',
                    'Status PHPP': '-',
                    'No. Bukti PHPP': '-',
                    'Nama Penerima/Pembeli': '-',
                    'Unit Penerima/Pembeli': '-',
                    'Harga Jual': 0,
                    'Laba/Rugi Penjualan': 0
                };
            });

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Laporan Aset Lengkap");
            XLSX.writeFile(wb, `Laporan_Aset_Menyeluruh_${now.toISOString().split('T')[0]}.xlsx`);
        } catch (err) {
            console.error("Gagal mendownload laporan:", err);
            alert("Gagal mendownload laporan. Silakan coba lagi.");
        } finally {
            setDownloading(false);
        }
    };

    if (loading) return (
        <div className="flex h-96 items-center justify-center">
            <Loader2 className="animate-spin text-blue-600" size={40} />
        </div>
    );

    const stats = [
        { title: "Total Aset", value: data?.stats?.totalAssets?.toLocaleString() || '0', icon: Box, color: "bg-blue-500", desc: "Total item terdaftar" },
        { title: "Nilai Buku (Terkini)", value: `Rp ${(data?.stats?.totalValue || 0).toLocaleString()}`, icon: DollarSign, color: "bg-emerald-500", desc: "Estimasi nilai buku saat ini" },
        { title: "Aset Rusak", value: data?.stats?.damagedAssets?.toLocaleString() || '0', icon: AlertTriangle, color: "bg-red-500", desc: "Perlu perhatian" },
        { title: "Habis Umur", value: data?.stats?.expiredAssets?.toLocaleString() || '0', icon: TrendingDown, color: "bg-orange-500", desc: "Melewati masa manfaat" },
    ];

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
                    <p className="text-slate-500 text-sm">Ringkasan statistik aset perusahaan</p>
                </div>
                <button
                    onClick={handleDownloadReport}
                    disabled={downloading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
                >
                    {downloading ? (
                        <Loader2 className="animate-spin" size={18} />
                    ) : (
                        <Download size={18} />
                    )}
                    {downloading ? "Mengunduh..." : "Download Laporan"}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((s, i) => <StatCard key={i} {...s} />)}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-slate-700">Statistik Pengadaan Aset</h3>
                        <select className="text-sm border-slate-200 rounded-md text-slate-500 bg-slate-50 p-1">
                            <option>Tahun Ini</option>
                            <option>Tahun Lalu</option>
                        </select>
                    </div>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data?.chartData || []}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    cursor={{ fill: '#f1f5f9' }}
                                />
                                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-700 mb-6">Komposisi Kategori</h3>
                    <div className="h-72 flex justify-center items-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data?.pieData || []}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={80}
                                    outerRadius={110}
                                    fill="#8884d8"
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {(data?.pieData || []).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-4 mt-4 flex-wrap">
                        {(data?.pieData || []).map((entry, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                <span className="text-xs text-slate-500">{entry.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
