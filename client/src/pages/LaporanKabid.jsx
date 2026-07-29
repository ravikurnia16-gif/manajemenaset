import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Users, AlertCircle, FileText, CheckCircle2, Clock, ChevronDown, ChevronRight, Download, Award, AlertTriangle } from 'lucide-react';
import api from '../lib/axios';
import dayjs from 'dayjs';
import LaporanStaff from './LaporanStaff';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';

const LaporanKabid = () => {
    const [summary, setSummary] = useState([]);
    const [dateRangeStr, setDateRangeStr] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [startDate, setStartDate] = useState(dayjs().format('YYYY-MM-DD'));
    const [endDate, setEndDate] = useState(dayjs().format('YYYY-MM-DD'));
    const [expandedUserId, setExpandedUserId] = useState(null);

    useEffect(() => {
        if (activeTab === 'dashboard') {
            fetchSummary();
        }
    }, [activeTab, startDate, endDate]);

    const fetchSummary = async () => {
        try {
            setLoading(true);
            const res = await api.get('/laporan/kabid/summary', {
                params: { startDate, endDate }
            });
            if (res.data.summary) {
                setSummary(res.data.summary);
                setDateRangeStr(res.data.dateRange || []);
            } else {
                // Backward compatibility if API hasn't restarted yet
                setSummary(res.data);
                setDateRangeStr([startDate]);
            }
        } catch (error) {
            console.error('Failed to fetch kabid summary', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleExpand = (userId) => {
        setExpandedUserId(expandedUserId === userId ? null : userId);
    };

    const handleExportExcel = () => {
        if (!summary || summary.length === 0) return;

        const data = summary.map(user => {
            const row = {
                'Nama Staf': user.name,
                'Posisi': user.position
            };
            dateRangeStr.forEach(d => {
                row[dayjs(d).format('DD MMM YYYY')] = user.summaryByDate?.[d]?.status || user.status;
            });
            return row;
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Rekap_Laporan');
        XLSX.writeFile(wb, `Rekap_Laporan_Sarpras_${startDate}_to_${endDate}.xlsx`);
    };

    // --- Analytics Derived Data ---
    const chartData = useMemo(() => {
        if (!dateRangeStr || dateRangeStr.length === 0) return [];
        return dateRangeStr.map(date => {
            let lengkap = 0;
            let parsial = 0;
            let belum = 0;
            summary.forEach(user => {
                const s = user.summaryByDate?.[date]?.status || 'BELUM';
                if (s === 'LENGKAP') lengkap++;
                else if (s === 'PARSIAL') parsial++;
                else belum++;
            });
            return {
                name: dayjs(date).format('DD MMM'),
                Lengkap: lengkap,
                Parsial: parsial,
                Belum: belum
            };
        });
    }, [summary, dateRangeStr]);

    const leaderboards = useMemo(() => {
        if (!summary || summary.length === 0) return { top: [], bottom: [] };
        const stats = summary.map(user => {
            let totalLengkap = 0;
            let totalBelum = 0;
            dateRangeStr.forEach(d => {
                const s = user.summaryByDate?.[d]?.status || 'BELUM';
                if (s === 'LENGKAP') totalLengkap++;
                if (s === 'BELUM') totalBelum++;
            });
            return { ...user, totalLengkap, totalBelum };
        });
        
        const sortedLengkap = [...stats].sort((a, b) => b.totalLengkap - a.totalLengkap);
        const sortedBelum = [...stats].sort((a, b) => b.totalBelum - a.totalBelum);
        
        return {
            top: sortedLengkap.slice(0, 3).filter(u => u.totalLengkap > 0),
            bottom: sortedBelum.slice(0, 3).filter(u => u.totalBelum > 0)
        };
    }, [summary, dateRangeStr]);


    const renderReportContent = (reportData) => {
        if (!reportData) return <span className="italic text-slate-400 text-[11px]">- Belum ada isi laporan -</span>;

        const renderList = (title, list) => {
            if (!list || list.length === 0) return null;
            return (
                <div className="mb-4 last:mb-0">
                    {title && <div className="text-[10px] font-black text-slate-400 uppercase mb-2 border-b border-slate-100 pb-1">{title}</div>}
                    <ul className="list-none space-y-3">
                        {list.map((pt, idx) => {
                            const text = typeof pt === 'string' ? pt : pt.text;
                            let photos = [];
                            if (typeof pt !== 'string') {
                                if (pt.photos && Array.isArray(pt.photos)) photos = pt.photos;
                                else if (pt.photo) photos = [{ url: pt.photo, timestamp: pt.timestamp }];
                            }
                            return (
                                <li key={idx} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                    <div className="flex gap-2 items-start">
                                        <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</div>
                                        <div className="flex-1 overflow-hidden">
                                            <p className="text-sm text-slate-700">{text}</p>
                                            {photos.length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-4 items-start">
                                                    {photos.map((ph, pIdx) => (
                                                        <div key={pIdx} className="flex flex-col gap-1">
                                                            <a href={ph.url} target="_blank" rel="noreferrer" className="block w-28 h-28 rounded-lg overflow-hidden border border-slate-200 hover:opacity-80 transition-opacity">
                                                                <img src={ph.url} alt={`Lampiran ${idx + 1}-${pIdx + 1}`} className="w-full h-full object-cover" />
                                                            </a>
                                                            {ph.timestamp && (
                                                                <div className="text-[9px] font-bold text-slate-500 flex items-center justify-center gap-1 bg-slate-50 px-1 py-1 rounded-md border border-slate-200 shadow-sm">
                                                                    <Clock size={10} className="text-blue-500" />
                                                                    {dayjs(ph.timestamp).format('HH:mm')}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            );
        };

        const m = reportData.morning || [];
        const a = reportData.afternoon || [];
        if (m.length === 0 && a.length === 0) return <span className="italic text-slate-400 text-[11px]">- Belum ada isi laporan -</span>;
        return (
            <>
                {renderList('Kegiatan Pagi (07.30 - 12.00)', m)}
                {renderList('Kegiatan Siang (13.00 - 16.15)', a)}
            </>
        );
    };

    if (activeTab === 'laporan-saya') {
        return (
            <div className="space-y-4">
                <div className="flex gap-2 bg-slate-100 p-1 rounded-xl w-fit mb-4">
                    <button 
                        onClick={() => setActiveTab('dashboard')}
                        className="px-4 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-700 transition-all"
                    >
                        Dashboard Rekap
                    </button>
                    <button 
                        className="px-4 py-2 rounded-lg text-sm font-bold bg-white text-blue-600 shadow-sm transition-all"
                    >
                        Laporan Saya (Kabid)
                    </button>
                </div>
                <LaporanStaff />
            </div>
        );
    }

    const isMultiDay = dateRangeStr.length > 1;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Dashboard Laporan Sarpras</h1>
                    <p className="text-slate-500 text-sm">Pantau kedisiplinan pelaporan harian staf Divisi Sarana dan Prasarana.</p>
                </div>
                
                <div className="flex items-center gap-4">
                    <button 
                        onClick={handleExportExcel}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-emerald-500 text-white shadow-sm hover:bg-emerald-600 transition-all"
                    >
                        <Download size={16} /> Export Excel
                    </button>
                    <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
                        <button 
                            className="px-4 py-2 rounded-lg text-sm font-bold bg-white text-blue-600 shadow-sm transition-all"
                        >
                            Dashboard Rekap
                        </button>
                        <button 
                            onClick={() => setActiveTab('laporan-saya')}
                            className="px-4 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-700 transition-all"
                        >
                            Laporan Saya (Kabid)
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-center gap-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-500">
                        <Calendar size={20} />
                    </div>
                    <div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mulai Tanggal</div>
                        <input 
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="font-bold text-slate-700 bg-transparent border-none p-0 focus:ring-0"
                        />
                    </div>
                </div>
                <div className="hidden md:block w-px h-10 bg-slate-200"></div>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center text-orange-500">
                        <Calendar size={20} />
                    </div>
                    <div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sampai Tanggal</div>
                        <input 
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="font-bold text-slate-700 bg-transparent border-none p-0 focus:ring-0"
                            min={startDate}
                        />
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="h-64 flex items-center justify-center">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
                </div>
            ) : (
                <>
                    {/* Analytics Section (Only show if date range > 1 day) */}
                    {isMultiDay && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider">Tren Kedisiplinan</h3>
                                <div className="h-64 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                            <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                            <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                            <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 600 }} />
                                            <Bar dataKey="Lengkap" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} />
                                            <Bar dataKey="Parsial" stackId="a" fill="#f59e0b" />
                                            <Bar dataKey="Belum" stackId="a" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            
                            <div className="space-y-6">
                                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                                    <h3 className="text-xs font-black text-emerald-500 mb-3 uppercase tracking-wider flex items-center gap-2">
                                        <Award size={16} /> Staf Terdisiplin
                                    </h3>
                                    <div className="space-y-3">
                                        {leaderboards.top.length > 0 ? leaderboards.top.map((u, i) => (
                                            <div key={i} className="flex justify-between items-center text-sm">
                                                <span className="font-bold text-slate-700 truncate max-w-[150px]">{u.name}</span>
                                                <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold text-xs">{u.totalLengkap} LENGKAP</span>
                                            </div>
                                        )) : <span className="text-xs text-slate-400">Belum ada data</span>}
                                    </div>
                                </div>
                                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                                    <h3 className="text-xs font-black text-rose-500 mb-3 uppercase tracking-wider flex items-center gap-2">
                                        <AlertTriangle size={16} /> Butuh Perhatian
                                    </h3>
                                    <div className="space-y-3">
                                        {leaderboards.bottom.length > 0 ? leaderboards.bottom.map((u, i) => (
                                            <div key={i} className="flex justify-between items-center text-sm">
                                                <span className="font-bold text-slate-700 truncate max-w-[150px]">{u.name}</span>
                                                <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-bold text-xs">{u.totalBelum} ALPA</span>
                                            </div>
                                        )) : <span className="text-xs text-slate-400">Semua aman!</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                            <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                <FileText size={18} className="text-blue-500" />
                                Rincian Kedisiplinan {isMultiDay ? 'Mingguan/Bulanan' : 'Harian'}
                            </h2>
                            <p className="text-xs text-slate-400">Klik baris untuk melihat isi laporan</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-8"></th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Nama Staf</th>
                                        
                                        {/* Dynamic Columns based on Date Range */}
                                        {isMultiDay ? (
                                            dateRangeStr.map((d, i) => (
                                                <th key={i} className="px-4 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">
                                                    {dayjs(d).format('DD/MM')}
                                                </th>
                                            ))
                                        ) : (
                                            <>
                                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Posisi</th>
                                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Sesi Pagi</th>
                                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Sesi Siang</th>
                                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Status</th>
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {summary.map(user => (
                                        <React.Fragment key={user.id}>
                                            <tr 
                                                className="transition-colors hover:bg-slate-50/50 cursor-pointer"
                                                onClick={() => toggleExpand(user.id)}
                                            >
                                                <td className="pl-6 py-4 w-8">
                                                    {expandedUserId === user.id 
                                                        ? <ChevronDown size={16} className="text-blue-500" /> 
                                                        : <ChevronRight size={16} className="text-slate-400" />
                                                    }
                                                </td>
                                                
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-slate-700">{user.name}</div>
                                                    {isMultiDay && <div className="text-[10px] font-medium text-slate-400">{user.position}</div>}
                                                </td>

                                                {isMultiDay ? (
                                                    dateRangeStr.map((d, i) => {
                                                        const stat = user.summaryByDate?.[d]?.status;
                                                        return (
                                                            <td key={i} className="px-4 py-4 text-center">
                                                                {stat === 'LENGKAP' && <div className="mx-auto w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center" title="Lengkap"><CheckCircle2 size={12} /></div>}
                                                                {stat === 'PARSIAL' && <div className="mx-auto w-6 h-6 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center font-bold text-[10px]" title="Parsial">1/2</div>}
                                                                {(!stat || stat === 'BELUM') && <div className="mx-auto w-6 h-6 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center" title="Belum Lapor"><AlertCircle size={12} /></div>}
                                                            </td>
                                                        );
                                                    })
                                                ) : (
                                                    <>
                                                        <td className="px-6 py-4">
                                                            <div className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded w-fit">
                                                                {user.position}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            {user.hasMorning ? (
                                                                <div className="inline-flex items-center justify-center w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full"><CheckCircle2 size={16} /></div>
                                                            ) : (
                                                                <div className="inline-flex items-center justify-center w-8 h-8 bg-slate-100 text-slate-400 rounded-full"><Clock size={16} /></div>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            {user.hasAfternoon ? (
                                                                <div className="inline-flex items-center justify-center w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full"><CheckCircle2 size={16} /></div>
                                                            ) : (
                                                                <div className="inline-flex items-center justify-center w-8 h-8 bg-slate-100 text-slate-400 rounded-full"><Clock size={16} /></div>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            {user.status === 'LENGKAP' && <span className="inline-flex px-2 py-1 text-[10px] font-bold bg-emerald-100 text-emerald-700 rounded-md">LENGKAP</span>}
                                                            {user.status === 'PARSIAL' && <span className="inline-flex px-2 py-1 text-[10px] font-bold bg-orange-100 text-orange-700 rounded-md">PARSIAL</span>}
                                                            {user.status === 'BELUM' && <span className="inline-flex px-2 py-1 text-[10px] font-bold bg-rose-100 text-rose-700 rounded-md">BELUM LAPOR</span>}
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                            
                                            {/* Expanded View (For both single and multi-day modes) */}
                                            {expandedUserId === user.id && (
                                                <tr>
                                                    <td colSpan={isMultiDay ? dateRangeStr.length + 2 : 6} className="px-6 py-4 bg-slate-50/80">
                                                        <div className="p-4 border border-slate-200 rounded-2xl bg-white shadow-sm">
                                                            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                                                                <FileText size={16} className="text-blue-500" />
                                                                <span className="text-sm font-black text-slate-700 uppercase tracking-wider">
                                                                    Isi Laporan — {user.name}
                                                                </span>
                                                            </div>
                                                            <div className="text-sm text-slate-600 font-medium flex flex-col gap-6">
                                                                {isMultiDay ? (
                                                                    dateRangeStr.map((d, dIdx) => {
                                                                        const repData = user.summaryByDate?.[d]?.reportData;
                                                                        if (!repData) return null;
                                                                        return (
                                                                            <div key={dIdx} className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                                                                <div className="text-xs font-black text-slate-500 mb-3 bg-white px-3 py-1.5 rounded-lg border border-slate-200 inline-block">
                                                                                    {dayjs(d).format('DD MMMM YYYY')}
                                                                                </div>
                                                                                {renderReportContent(repData)}
                                                                            </div>
                                                                        );
                                                                    })
                                                                ) : (
                                                                    renderReportContent(user.reportData)
                                                                )}
                                                                
                                                                {isMultiDay && dateRangeStr.every(d => !user.summaryByDate?.[d]?.reportData) && (
                                                                    <div className="text-center text-slate-400 italic text-xs py-4">
                                                                        Belum ada isi laporan dalam rentang tanggal ini.
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                    {summary.length === 0 && (
                                        <tr>
                                            <td colSpan={isMultiDay ? dateRangeStr.length + 1 : 6} className="px-6 py-12 text-center text-slate-400">
                                                Belum ada data staf untuk ditampilkan.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default LaporanKabid;
