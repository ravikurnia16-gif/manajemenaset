import React, { useState, useEffect } from 'react';
import { Calendar, Users, AlertCircle, FileText, CheckCircle2, Clock } from 'lucide-react';
import api from '../lib/axios';
import dayjs from 'dayjs';
import LaporanStaff from './LaporanStaff'; // Import for the "Laporan Saya" part

const LaporanKabid = () => {
    const [summary, setSummary] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [currentDate, setCurrentDate] = useState(dayjs().format('YYYY-MM-DD'));

    useEffect(() => {
        if (activeTab === 'dashboard') {
            fetchSummary();
        }
    }, [activeTab, currentDate]);

    const fetchSummary = async () => {
        try {
            setLoading(true);
            const res = await api.get('/laporan/kabid/summary', {
                params: { date: currentDate }
            });
            setSummary(res.data);
        } catch (error) {
            console.error('Failed to fetch kabid summary', error);
        } finally {
            setLoading(false);
        }
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

    const belumLapor = summary.filter(s => s.status === 'BELUM');
    const parsialLapor = summary.filter(s => s.status === 'PARSIAL');
    const lengkapLapor = summary.filter(s => s.status === 'LENGKAP');

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Dashboard Laporan Sarpras</h1>
                    <p className="text-slate-500 text-sm">Pantau kedisiplinan pelaporan harian staf Divisi Sarana dan Prasarana.</p>
                </div>
                
                <div className="flex items-center gap-4">
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

            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-500">
                        <Calendar size={20} />
                    </div>
                    <div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tanggal Laporan</div>
                        <input 
                            type="date"
                            value={currentDate}
                            onChange={(e) => setCurrentDate(e.target.value)}
                            className="font-bold text-slate-700 bg-transparent border-none p-0 focus:ring-0"
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-start justify-between">
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase mb-1">Total Staf</p>
                                <h3 className="text-3xl font-black text-slate-800">{summary.length}</h3>
                            </div>
                            <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center">
                                <Users size={24} />
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-start justify-between">
                            <div>
                                <p className="text-xs font-bold text-emerald-500 uppercase mb-1">Lengkap Lapor</p>
                                <h3 className="text-3xl font-black text-emerald-600">{lengkapLapor.length}</h3>
                            </div>
                            <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center">
                                <CheckCircle2 size={24} />
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-rose-100 shadow-sm flex items-start justify-between relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-full blur-3xl -mr-10 -mt-10"></div>
                            <div className="relative z-10">
                                <p className="text-xs font-bold text-rose-500 uppercase mb-1">Belum Lapor</p>
                                <h3 className="text-3xl font-black text-rose-600">{belumLapor.length}</h3>
                            </div>
                            <div className="relative z-10 w-12 h-12 bg-rose-100 text-rose-500 rounded-2xl flex items-center justify-center">
                                <AlertCircle size={24} />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                            <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                <FileText size={18} className="text-blue-500" />
                                Rincian Kedisiplinan Laporan
                            </h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Nama Staf</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Posisi</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Sesi Pagi</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Sesi Siang</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {summary.map(user => (
                                        <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-700">{user.name}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded w-fit">
                                                    {user.position}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {user.hasMorning ? (
                                                    <div className="inline-flex items-center justify-center w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full">
                                                        <CheckCircle2 size={16} />
                                                    </div>
                                                ) : (
                                                    <div className="inline-flex items-center justify-center w-8 h-8 bg-slate-100 text-slate-400 rounded-full">
                                                        <Clock size={16} />
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {user.hasAfternoon ? (
                                                    <div className="inline-flex items-center justify-center w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full">
                                                        <CheckCircle2 size={16} />
                                                    </div>
                                                ) : (
                                                    <div className="inline-flex items-center justify-center w-8 h-8 bg-slate-100 text-slate-400 rounded-full">
                                                        <Clock size={16} />
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {user.status === 'LENGKAP' && <span className="inline-flex px-2 py-1 text-[10px] font-bold bg-emerald-100 text-emerald-700 rounded-md">LENGKAP</span>}
                                                {user.status === 'PARSIAL' && <span className="inline-flex px-2 py-1 text-[10px] font-bold bg-orange-100 text-orange-700 rounded-md">PARSIAL</span>}
                                                {user.status === 'BELUM' && <span className="inline-flex px-2 py-1 text-[10px] font-bold bg-rose-100 text-rose-700 rounded-md">BELUM LAPOR</span>}
                                            </td>
                                        </tr>
                                    ))}
                                    {summary.length === 0 && (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
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
