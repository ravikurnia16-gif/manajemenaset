import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    CalendarRange, RefreshCw, Filter, Sparkles, Loader2,
    Calendar, Truck, ShieldAlert, BarChart3, AlertCircle,
    FileText, Download
} from 'lucide-react';
import api from '../lib/axios';
import { cn } from '../lib/utils';
import VehicleSevenReportsSection from '../pages/Vehicle/components/VehicleSevenReportsSection';

export default function VehicleWeeklySevenReportsTab({ currentUser }) {
    const navigate = useNavigate();
    const reportsExportRef = useRef(null);

    // Preset: 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'summary' | 'custom'
    const [preset, setPreset] = useState('this_week');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Hitung tanggal sesuai preset
    const calculateDatesForPreset = (p) => {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

        const day = now.getDay();
        const diffToMonday = (day === 0 ? -6 : 1 - day);

        if (p === 'this_week') {
            const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
            const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday + 6);
            return { start: toYMD(monday), end: toYMD(sunday) };
        } else if (p === 'last_week') {
            const lastMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday - 7);
            const lastSunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday - 1);
            return { start: toYMD(lastMonday), end: toYMD(lastSunday) };
        } else if (p === 'this_month') {
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            return { start: toYMD(firstDay), end: toYMD(now) };
        } else if (p === 'last_month') {
            const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
            return { start: toYMD(firstDay), end: toYMD(lastDay) };
        } else if (p === 'summary') {
            return { start: '', end: '' };
        }
        return { start: startDate, end: endDate };
    };

    // Inisialisasi awal ke 'this_week'
    useEffect(() => {
        const { start, end } = calculateDatesForPreset('this_week');
        setStartDate(start);
        setEndDate(end);
    }, []);

    // Fetch data setiap startDate / endDate / preset berubah
    const fetchVehicleData = async (s = startDate, e = endDate, p = preset) => {
        try {
            setLoading(true);
            setError(null);
            let query = '';
            if (p === 'summary') {
                query = '';
            } else if (s && e) {
                query = `?startDate=${s}&endDate=${e}`;
            } else if (s) {
                query = `?startDate=${s}`;
            }
            const res = await api.get(`/vehicles/dashboard${query}`);
            setData(res.data);
        } catch (err) {
            console.error('Failed to load vehicle dashboard reports:', err);
            setError(err.response?.data?.error || err.message || 'Gagal memuat data laporan kendaraan');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (preset !== 'custom' && startDate && endDate) {
            fetchVehicleData(startDate, endDate, preset);
        } else if (preset === 'summary') {
            fetchVehicleData('', '', 'summary');
        }
    }, [startDate, endDate, preset]);

    const handleSelectPreset = (p) => {
        setPreset(p);
        if (p === 'custom') return;
        const { start, end } = calculateDatesForPreset(p);
        setStartDate(start);
        setEndDate(end);
    };

    const handleApplyCustom = () => {
        if (!startDate || !endDate) {
            alert('Silakan pilih tanggal awal dan akhir.');
            return;
        }
        if (new Date(startDate) > new Date(endDate)) {
            alert('Tanggal awal tidak boleh melebihi tanggal akhir.');
            return;
        }
        setPreset('custom');
        fetchVehicleData(startDate, endDate, 'custom');
    };

    const periodLabel = useMemo(() => {
        if (preset === 'summary' || (!startDate && !endDate)) {
            return 'Ringkasan Kumulatif Semua Periode';
        }
        if (startDate && endDate) {
            const sStr = new Date(startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
            const eStr = new Date(endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
            return `${sStr} s/d ${eStr}`;
        }
        if (startDate) {
            return `Mulai ${new Date(startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
        }
        return 'Periode Terpilih';
    }, [preset, startDate, endDate]);

    return (
        <div className="space-y-6">
            {/* Filter & Toolbar Kendaraan */}
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
                                <Truck size={20} />
                            </span>
                            <div>
                                <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                                    7 Laporan Utama Armada & Analisis AI
                                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                                        <Sparkles size={11} /> Statistik & AI
                                    </span>
                                </h2>
                                <p className="text-xs text-slate-500 font-medium">
                                    Rekap logbook peminjaman, efisiensi BBM, jadwal bus, omset, pemeliharaan servis, kinerja supir, dan sanksi pelanggaran dalam satu dokumen resmi.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                        <button
                            onClick={() => fetchVehicleData(startDate, endDate, preset)}
                            disabled={loading}
                            className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all disabled:opacity-50"
                            title="Segarkan Data"
                        >
                            <RefreshCw size={16} className={cn(loading && "animate-spin text-indigo-600")} />
                        </button>

                        {/* Opsi 1: Ekspor PDF */}
                        <button
                            onClick={() => reportsExportRef.current?.exportPDF()}
                            disabled={loading || !data}
                            className="flex items-center gap-2 bg-gradient-to-r from-rose-600 via-rose-700 to-rose-800 hover:from-rose-700 hover:to-rose-900 text-white px-4 py-2.5 rounded-2xl text-xs font-black shadow-md shadow-rose-200 transition-all disabled:opacity-50"
                            title="Unduh seluruh 7 indikator gabungan dalam format PDF"
                        >
                            <FileText size={15} />
                            Ekspor PDF (7 Indikator)
                        </button>

                        {/* Opsi 2: Ekspor DOC */}
                        <button
                            onClick={() => reportsExportRef.current?.exportDOC()}
                            disabled={loading || !data}
                            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 via-indigo-700 to-indigo-800 hover:from-blue-700 hover:to-indigo-900 text-white px-4 py-2.5 rounded-2xl text-xs font-black shadow-md shadow-blue-200 transition-all disabled:opacity-50"
                            title="Unduh seluruh 7 indikator gabungan dalam format Microsoft Word / DOC"
                        >
                            <Download size={15} />
                            Ekspor DOC (7 Indikator)
                        </button>
                    </div>
                </div>

                {/* Preset Period Buttons: Minggu Ini, Pekan Lalu, Bulan Ini, Bulan Lalu, Semua Periode, Kustom */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] mr-1 flex items-center gap-1">
                            <Filter size={12} /> Pilihan Periode:
                        </span>
                        {[
                            { key: 'this_week', label: 'Minggu Ini' },
                            { key: 'last_week', label: 'Pekan Lalu' },
                            { key: 'this_month', label: 'Bulan Ini' },
                            { key: 'last_month', label: 'Bulan Lalu' },
                            { key: 'summary', label: 'Semua Periode' },
                            { key: 'custom', label: 'Kustom' },
                        ].map((p) => (
                            <button
                                key={p.key}
                                onClick={() => handleSelectPreset(p.key)}
                                className={cn(
                                    "px-3.5 py-1.5 rounded-xl font-bold transition-all text-xs",
                                    preset === p.key
                                        ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200"
                                        : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60"
                                )}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    {/* Date Pickers */}
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
                            <Calendar size={13} className="text-slate-400" />
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => {
                                    setStartDate(e.target.value);
                                    setPreset('custom');
                                }}
                                className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none"
                            />
                        </div>
                        <span className="text-slate-400 text-xs font-bold">s/d</span>
                        <div className="flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
                            <Calendar size={13} className="text-slate-400" />
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => {
                                    setEndDate(e.target.value);
                                    setPreset('custom');
                                }}
                                className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none"
                            />
                        </div>
                        {preset === 'custom' && (
                            <button
                                onClick={handleApplyCustom}
                                className="px-3.5 py-1 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-all shadow-sm"
                            >
                                Terapkan
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Content Area */}
            {loading ? (
                <div className="bg-white p-12 rounded-3xl border border-slate-100 text-center space-y-3">
                    <Loader2 size={32} className="animate-spin text-indigo-600 mx-auto" />
                    <p className="text-xs font-bold text-slate-500">Memuat 7 Laporan Utama Armada Kendaraan...</p>
                </div>
            ) : error ? (
                <div className="bg-rose-50 border border-rose-200 p-6 rounded-3xl text-rose-800 flex items-start gap-3">
                    <AlertCircle size={20} className="shrink-0 mt-0.5 text-rose-600" />
                    <div>
                        <h4 className="font-bold text-sm">Gagal Mengambil Data Armada</h4>
                        <p className="text-xs text-rose-600 mt-1">{error}</p>
                        <button
                            onClick={() => fetchVehicleData(startDate, endDate, preset)}
                            className="mt-3 px-3 py-1 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700 transition-all"
                        >
                            Coba Lagi
                        </button>
                    </div>
                </div>
            ) : (
                <VehicleSevenReportsSection
                    data={data}
                    periodLabel={periodLabel}
                    currentUser={currentUser}
                    exportRef={reportsExportRef}
                    onNavigateToReport={(cat) => navigate('/kendaraan/dashboard')}
                />
            )}
        </div>
    );
}
