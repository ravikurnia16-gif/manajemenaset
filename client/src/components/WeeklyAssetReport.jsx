import { useState, useEffect, useMemo } from 'react';
import {
    Box, ArrowLeftRight, Wrench, ClipboardCheck, Handshake, Trash2,
    Calendar, CalendarRange, Printer, RefreshCw, Eye, Download,
    CheckCircle2, AlertCircle, Clock, Search, ChevronRight, Layers
} from 'lucide-react';
import api from '../lib/axios';
import { cn } from '../lib/utils';

export default function WeeklyAssetReport({ currentUser }) {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [preset, setPreset] = useState('this_week'); // 'this_week' | 'last_week' | 'this_month' | 'custom'
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedUnit, setSelectedUnit] = useState('all');
    const [activeTab, setActiveTab] = useState('new_assets'); // 'new_assets' | 'movements' | 'maintenance' | 'audit' | 'loans' | 'disposals'
    const [showPrintPreview, setShowPrintPreview] = useState(false);
    const [showIndividualAssetList, setShowIndividualAssetList] = useState(false);

    // Hitung tanggal berdasarkan preset
    const calculatePresetDates = (selectedPreset) => {
        const now = new Date();
        if (selectedPreset === 'this_week') {
            const day = now.getDay();
            const diffToMonday = now.getDate() - (day === 0 ? 6 : day - 1);
            const monday = new Date(now.getFullYear(), now.getMonth(), diffToMonday);
            const friday = new Date(now.getFullYear(), now.getMonth(), diffToMonday + 4);
            return {
                start: monday.toISOString().split('T')[0],
                end: friday.toISOString().split('T')[0]
            };
        } else if (selectedPreset === 'last_week') {
            const day = now.getDay();
            const diffToLastMonday = now.getDate() - (day === 0 ? 6 : day - 1) - 7;
            const monday = new Date(now.getFullYear(), now.getMonth(), diffToLastMonday);
            const friday = new Date(now.getFullYear(), now.getMonth(), diffToLastMonday + 4);
            return {
                start: monday.toISOString().split('T')[0],
                end: friday.toISOString().split('T')[0]
            };
        } else if (selectedPreset === 'this_month') {
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            return {
                start: firstDay.toISOString().split('T')[0],
                end: lastDay.toISOString().split('T')[0]
            };
        }
        return { start: startDate, end: endDate };
    };

    // Saat mount, inisialisasi dengan Minggu Ini
    useEffect(() => {
        const { start, end } = calculatePresetDates('this_week');
        setStartDate(start);
        setEndDate(end);
    }, []);

    // Fetch data setiap kali startDate, endDate, atau selectedUnit berubah
    useEffect(() => {
        if (startDate && endDate) {
            fetchReport();
        }
    }, [startDate, endDate, selectedUnit]);

    const fetchReport = async () => {
        try {
            setLoading(true);
            const params = {
                startDate,
                endDate
            };
            if (selectedUnit !== 'all') params.unitId = selectedUnit;

            const res = await api.get('/dashboard/weekly-report', { params });
            setData(res.data);
        } catch (err) {
            console.error('Failed to load weekly asset report:', err);
        } finally {
            setLoading(false);
        }
    };

    const handlePresetChange = (newPreset) => {
        setPreset(newPreset);
        if (newPreset !== 'custom') {
            const { start, end } = calculatePresetDates(newPreset);
            setStartDate(start);
            setEndDate(end);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const summary = data?.summary || {
        newAssetsCount: 0,
        newAssetsValue: 0,
        movementsCount: 0,
        maintenanceCount: 0,
        maintenanceCost: 0,
        auditCount: 0,
        loansCount: 0,
        disposalsCount: 0
    };

    const details = data?.details || {
        newAssets: [],
        movements: [],
        maintenances: [],
        auditItems: [],
        loans: [],
        disposals: []
    };

    // Rekapitulasi kuantitas pengadaan barang baru (Grouping nama barang & kategori)
    const groupedNewAssets = useMemo(() => {
        const map = new Map();
        (details.newAssets || []).forEach(item => {
            const rawName = (item.name || 'Aset Tanpa Nama').trim();
            const categoryName = item.category?.name || '-';
            const unitName = item.unit?.name || '-';
            const key = `${rawName.toLowerCase()}___${categoryName.toLowerCase()}`;
            if (!map.has(key)) {
                map.set(key, {
                    name: rawName,
                    category: categoryName,
                    unit: unitName,
                    qty: 0,
                    totalPrice: 0,
                });
            }
            const g = map.get(key);
            g.qty += 1;
            g.totalPrice += (Number(item.price) || 0);
            if (unitName !== '-' && g.unit !== unitName && !g.unit.includes(unitName)) {
                g.unit = `${g.unit}, ${unitName}`;
            }
        });
        return Array.from(map.values()).sort((a, b) => b.qty - a.qty);
    }, [details.newAssets]);

    return (
        <div className="space-y-6">
            {/* 1. FILTER & ACTION TOOLBAR (SCREEN ONLY) */}
            <div className="print:hidden bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* PRESET BUTTONS */}
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Periode:</span>
                    <button
                        onClick={() => handlePresetChange('this_week')}
                        className={cn(
                            "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all",
                            preset === 'this_week'
                                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        )}
                    >
                        Minggu Ini
                    </button>
                    <button
                        onClick={() => handlePresetChange('last_week')}
                        className={cn(
                            "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all",
                            preset === 'last_week'
                                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        )}
                    >
                        Minggu Lalu
                    </button>
                    <button
                        onClick={() => handlePresetChange('this_month')}
                        className={cn(
                            "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all",
                            preset === 'this_month'
                                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        )}
                    >
                        Bulan Ini
                    </button>
                    <button
                        onClick={() => handlePresetChange('custom')}
                        className={cn(
                            "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all",
                            preset === 'custom'
                                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        )}
                    >
                        Kustom Tanggal
                    </button>
                </div>

                {/* DATE INPUTS & UNIT FILTER & ACTIONS */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                        <Calendar size={14} className="text-slate-400" />
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => { setStartDate(e.target.value); setPreset('custom'); }}
                            className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer"
                        />
                        <span className="text-xs text-slate-400">s/d</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => { setEndDate(e.target.value); setPreset('custom'); }}
                            className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer"
                        />
                    </div>

                    {data?.units && data.units.length > 0 && (
                        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                            <span className="text-xs font-bold text-slate-400 uppercase">Unit:</span>
                            <select
                                value={selectedUnit}
                                onChange={(e) => setSelectedUnit(e.target.value)}
                                className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer"
                            >
                                <option value="all">Semua Unit</option>
                                {data.units.map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <button
                        onClick={fetchReport}
                        disabled={loading}
                        className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-all"
                        title="Segarkan Data"
                    >
                        <RefreshCw size={16} className={cn(loading && "animate-spin text-indigo-600")} />
                    </button>

                    <button
                        onClick={() => setShowPrintPreview(!showPrintPreview)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all"
                    >
                        <Eye size={15} />
                        {showPrintPreview ? 'Tutup Preview' : 'Preview Cetak'}
                    </button>

                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 transition-all hover:scale-105"
                    >
                        <Printer size={15} />
                        Cetak Laporan
                    </button>
                </div>
            </div>

            {/* 2. SUMMARY METRIC CARDS (SCREEN ONLY) */}
            <div className="print:hidden grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {/* CARD 1: ASET BARU */}
                <div
                    onClick={() => setActiveTab('new_assets')}
                    className={cn(
                        "p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group",
                        activeTab === 'new_assets'
                            ? "bg-indigo-50/70 border-indigo-300 shadow-md shadow-indigo-100 ring-2 ring-indigo-500/20"
                            : "bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm"
                    )}
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500 text-white flex items-center justify-center shadow-sm">
                            <Box size={20} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-full">
                            Pengadaan
                        </span>
                    </div>
                    <div className="text-2xl font-black text-slate-800">{summary.newAssetsCount} <span className="text-xs font-semibold text-slate-400">Unit</span></div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Aset Baru Masuk</div>
                    <div className="text-xs font-bold text-indigo-700 mt-2 truncate">
                        Rp {summary.newAssetsValue.toLocaleString('id-ID')}
                    </div>
                </div>

                {/* CARD 2: MUTASI ASET */}
                <div
                    onClick={() => setActiveTab('movements')}
                    className={cn(
                        "p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group",
                        activeTab === 'movements'
                            ? "bg-blue-50/70 border-blue-300 shadow-md shadow-blue-100 ring-2 ring-blue-500/20"
                            : "bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm"
                    )}
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500 text-white flex items-center justify-center shadow-sm">
                            <ArrowLeftRight size={20} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-full">
                            Perpindahan
                        </span>
                    </div>
                    <div className="text-2xl font-black text-slate-800">{summary.movementsCount} <span className="text-xs font-semibold text-slate-400">Item</span></div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Mutasi Aset</div>
                    <div className="text-xs font-semibold text-slate-500 mt-2">
                        Perpindahan ruangan/unit
                    </div>
                </div>

                {/* CARD 3: PEMELIHARAAN */}
                <div
                    onClick={() => setActiveTab('maintenance')}
                    className={cn(
                        "p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group",
                        activeTab === 'maintenance'
                            ? "bg-amber-50/70 border-amber-300 shadow-md shadow-amber-100 ring-2 ring-amber-500/20"
                            : "bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm"
                    )}
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
                            <Wrench size={20} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-full">
                            Perbaikan
                        </span>
                    </div>
                    <div className="text-2xl font-black text-slate-800">{summary.maintenanceCount} <span className="text-xs font-semibold text-slate-400">Tiket</span></div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Pemeliharaan</div>
                    <div className="text-xs font-bold text-amber-700 mt-2 truncate">
                        Rp {summary.maintenanceCost.toLocaleString('id-ID')}
                    </div>
                </div>

                {/* CARD 4: AUDIT FISIK */}
                <div
                    onClick={() => setActiveTab('audit')}
                    className={cn(
                        "p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group",
                        activeTab === 'audit'
                            ? "bg-emerald-50/70 border-emerald-300 shadow-md shadow-emerald-100 ring-2 ring-emerald-500/20"
                            : "bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm"
                    )}
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                            <ClipboardCheck size={20} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                            Verifikasi
                        </span>
                    </div>
                    <div className="text-2xl font-black text-slate-800">{summary.auditCount} <span className="text-xs font-semibold text-slate-400">Item</span></div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Audit / Cek Fisik</div>
                    <div className="text-xs font-semibold text-slate-500 mt-2">
                        Pemeriksaan lapangan
                    </div>
                </div>

                {/* CARD 5: PEMINJAMAN */}
                <div
                    onClick={() => setActiveTab('loans')}
                    className={cn(
                        "p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group",
                        activeTab === 'loans'
                            ? "bg-violet-50/70 border-violet-300 shadow-md shadow-violet-100 ring-2 ring-violet-500/20"
                            : "bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm"
                    )}
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl bg-violet-500 text-white flex items-center justify-center shadow-sm">
                            <Handshake size={20} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-violet-700 bg-violet-100/70 px-2 py-0.5 rounded-full">
                            Peminjaman
                        </span>
                    </div>
                    <div className="text-2xl font-black text-slate-800">{summary.loansCount} <span className="text-xs font-semibold text-slate-400">Peminjaman</span></div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Peminjaman Aset</div>
                    <div className="text-xs font-semibold text-slate-500 mt-2">
                        Peminjaman aktif / kembali
                    </div>
                </div>

                {/* CARD 6: USULAN PENGHAPUSAN */}
                <div
                    onClick={() => setActiveTab('disposals')}
                    className={cn(
                        "p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group",
                        activeTab === 'disposals'
                            ? "bg-rose-50/70 border-rose-300 shadow-md shadow-rose-100 ring-2 ring-rose-500/20"
                            : "bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm"
                    )}
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow-sm">
                            <Trash2 size={20} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 bg-rose-100/70 px-2 py-0.5 rounded-full">
                            Disposal
                        </span>
                    </div>
                    <div className="text-2xl font-black text-slate-800">{summary.disposalsCount} <span className="text-xs font-semibold text-slate-400">Usulan</span></div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Penghapusan Aset</div>
                    <div className="text-xs font-semibold text-slate-500 mt-2">
                        Rusak berat / lelang
                    </div>
                </div>
            </div>

            {/* 3. ACTIVITY DETAILS TABS & TABLES (SCREEN ONLY) */}
            <div className="print:hidden bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {/* SUB-TABS HEADER */}
                <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50/80 border-b border-slate-100">
                    <button
                        onClick={() => setActiveTab('new_assets')}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                            activeTab === 'new_assets'
                                ? "bg-white text-indigo-700 shadow-sm"
                                : "text-slate-500 hover:text-slate-800"
                        )}
                    >
                        <Box size={14} />
                        Aset Baru Masuk ({details.newAssets.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('movements')}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                            activeTab === 'movements'
                                ? "bg-white text-blue-700 shadow-sm"
                                : "text-slate-500 hover:text-slate-800"
                        )}
                    >
                        <ArrowLeftRight size={14} />
                        Mutasi Aset ({details.movements.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('maintenance')}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                            activeTab === 'maintenance'
                                ? "bg-white text-amber-700 shadow-sm"
                                : "text-slate-500 hover:text-slate-800"
                        )}
                    >
                        <Wrench size={14} />
                        Pemeliharaan ({details.maintenances.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('audit')}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                            activeTab === 'audit'
                                ? "bg-white text-emerald-700 shadow-sm"
                                : "text-slate-500 hover:text-slate-800"
                        )}
                    >
                        <ClipboardCheck size={14} />
                        Audit Fisik ({details.auditItems.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('loans')}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                            activeTab === 'loans'
                                ? "bg-white text-violet-700 shadow-sm"
                                : "text-slate-500 hover:text-slate-800"
                        )}
                    >
                        <Handshake size={14} />
                        Peminjaman ({details.loans.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('disposals')}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                            activeTab === 'disposals'
                                ? "bg-white text-rose-700 shadow-sm"
                                : "text-slate-500 hover:text-slate-800"
                        )}
                    >
                        <Trash2 size={14} />
                        Usulan Penghapusan ({details.disposals.length})
                    </button>
                </div>

                {/* TAB CONTENT: NEW ASSETS */}
                {activeTab === 'new_assets' && (
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50/60 border-b border-slate-100">
                            <div>
                                <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                                    Rekapitulasi Kuantitas Pengadaan Aset ({groupedNewAssets.length} Jenis Barang)
                                </span>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    Total fisik terdata: <span className="font-bold text-indigo-600">{summary.newAssetsCount} unit aset</span> (Rp {summary.newAssetsValue.toLocaleString('id-ID')})
                                </p>
                            </div>
                            <button
                                onClick={() => setShowIndividualAssetList(!showIndividualAssetList)}
                                className="text-xs font-bold px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-all self-start sm:self-auto shadow-sm"
                            >
                                {showIndividualAssetList ? 'Tampilkan Rekap Kuantitas Saja' : 'Lihat Rincian Kode Aset'}
                            </button>
                        </div>

                        {!showIndividualAssetList ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider">
                                        <tr>
                                            <th className="px-5 py-3.5 text-center w-12">No</th>
                                            <th className="px-5 py-3.5">Nama Barang / Aset</th>
                                            <th className="px-5 py-3.5">Kategori</th>
                                            <th className="px-5 py-3.5">Unit Penerima</th>
                                            <th className="px-5 py-3.5 text-center">Jumlah (Qty)</th>
                                            <th className="px-5 py-3.5 text-right">Total Estimasi Nilai</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {groupedNewAssets.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-5 py-8 text-center text-slate-400 font-semibold">
                                                    Tidak ada data aset baru masuk pada periode ini.
                                                </td>
                                            </tr>
                                        ) : (
                                            groupedNewAssets.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                                                    <td className="px-5 py-3.5 text-center text-slate-400 font-semibold">{idx + 1}</td>
                                                    <td className="px-5 py-3.5 font-bold text-slate-800 text-sm">
                                                        {item.name}
                                                    </td>
                                                    <td className="px-5 py-3.5 text-slate-600 font-medium">
                                                        {item.category}
                                                    </td>
                                                    <td className="px-5 py-3.5 text-slate-600">
                                                        {item.unit}
                                                    </td>
                                                    <td className="px-5 py-3.5 text-center">
                                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-100">
                                                            {item.qty} unit
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3.5 text-right font-black text-slate-800 text-sm">
                                                        Rp {(item.totalPrice || 0).toLocaleString('id-ID')}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider">
                                        <tr>
                                            <th className="px-5 py-3.5">Kode & Nama Aset</th>
                                            <th className="px-5 py-3.5">Kategori</th>
                                            <th className="px-5 py-3.5">Unit & Ruangan</th>
                                            <th className="px-5 py-3.5">Kondisi</th>
                                            <th className="px-5 py-3.5 text-right">Harga Perolehan</th>
                                            <th className="px-5 py-3.5">Tgl Terdaftar</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {details.newAssets.map(item => (
                                            <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                                                <td className="px-5 py-3.5">
                                                    <div className="font-bold text-slate-800">{item.name}</div>
                                                    <div className="text-[10px] text-indigo-600 font-mono font-semibold">{item.code}</div>
                                                </td>
                                                <td className="px-5 py-3.5 text-slate-600 font-medium">
                                                    {item.category?.name || '-'}
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <div className="font-semibold text-slate-700">{item.unit?.name || '-'}</div>
                                                    <div className="text-[11px] text-slate-400">{item.room?.name || '-'}</div>
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <span className={cn(
                                                        "px-2 py-0.5 rounded-full text-[10px] font-black uppercase",
                                                        item.condition === 'BAIK' ? "bg-emerald-50 text-emerald-700" :
                                                        item.condition === 'RUSAK_RINGAN' ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
                                                    )}>
                                                        {item.condition}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3.5 text-right font-bold text-slate-800">
                                                    Rp {(item.price || 0).toLocaleString('id-ID')}
                                                </td>
                                                <td className="px-5 py-3.5 text-slate-500">
                                                    {new Date(item.createdAt).toLocaleDateString('id-ID')}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* TAB CONTENT: MOVEMENTS */}
                {activeTab === 'movements' && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider">
                                <tr>
                                    <th className="px-5 py-3.5">Aset</th>
                                    <th className="px-5 py-3.5">Lokasi Asal</th>
                                    <th className="px-5 py-3.5">Lokasi Tujuan</th>
                                    <th className="px-5 py-3.5">Pemohon</th>
                                    <th className="px-5 py-3.5">Status</th>
                                    <th className="px-5 py-3.5">Tanggal</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {details.movements.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-5 py-8 text-center text-slate-400 font-semibold">
                                            Tidak ada aktivitas mutasi aset pada periode ini.
                                        </td>
                                    </tr>
                                ) : (
                                    details.movements.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="px-5 py-3.5">
                                                <div className="font-bold text-slate-800">{item.asset?.name}</div>
                                                <div className="text-[10px] text-blue-600 font-mono font-semibold">{item.asset?.code}</div>
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-600 font-medium">
                                                {item.fromLocation || '-'}
                                            </td>
                                            <td className="px-5 py-3.5 font-bold text-slate-700">
                                                {item.toLocation || '-'}
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-600">
                                                {item.requester?.name || '-'}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded-full text-[10px] font-black uppercase",
                                                    item.status === 'APPROVED' ? "bg-emerald-50 text-emerald-700" :
                                                    item.status === 'REJECTED' ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"
                                                )}>
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-500">
                                                {new Date(item.date).toLocaleDateString('id-ID')}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* TAB CONTENT: MAINTENANCE */}
                {activeTab === 'maintenance' && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider">
                                <tr>
                                    <th className="px-5 py-3.5">Tiket & Judul</th>
                                    <th className="px-5 py-3.5">Unit / Pemohon</th>
                                    <th className="px-5 py-3.5">Teknisi</th>
                                    <th className="px-5 py-3.5">Status</th>
                                    <th className="px-5 py-3.5 text-right">Biaya</th>
                                    <th className="px-5 py-3.5">Tanggal</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {details.maintenances.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-5 py-8 text-center text-slate-400 font-semibold">
                                            Tidak ada riwayat pemeliharaan pada periode ini.
                                        </td>
                                    </tr>
                                ) : (
                                    details.maintenances.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="px-5 py-3.5">
                                                <div className="font-bold text-slate-800">{item.title}</div>
                                                <div className="text-[10px] text-amber-600 font-mono font-semibold">{item.code}</div>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="font-semibold text-slate-700">{item.unit?.name || '-'}</div>
                                                <div className="text-[11px] text-slate-400">{item.user?.name || '-'}</div>
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-600 font-medium">
                                                {item.technician || '-'}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded-full text-[10px] font-black uppercase",
                                                    item.status === 'COMPLETED' ? "bg-emerald-50 text-emerald-700" :
                                                    item.status === 'IN_PROGRESS' ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"
                                                )}>
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-right font-bold text-slate-800">
                                                Rp {(item.cost || 0).toLocaleString('id-ID')}
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-500">
                                                {new Date(item.createdAt).toLocaleDateString('id-ID')}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* TAB CONTENT: AUDIT */}
                {activeTab === 'audit' && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider">
                                <tr>
                                    <th className="px-5 py-3.5">Aset</th>
                                    <th className="px-5 py-3.5">Sesi Audit</th>
                                    <th className="px-5 py-3.5">Status Temuan</th>
                                    <th className="px-5 py-3.5">Kondisi</th>
                                    <th className="px-5 py-3.5">Auditor</th>
                                    <th className="px-5 py-3.5">Tanggal Verifikasi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {details.auditItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-5 py-8 text-center text-slate-400 font-semibold">
                                            Tidak ada catatan audit fisik aset pada periode ini.
                                        </td>
                                    </tr>
                                ) : (
                                    details.auditItems.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="px-5 py-3.5">
                                                <div className="font-bold text-slate-800">{item.asset?.name}</div>
                                                <div className="text-[10px] text-emerald-600 font-mono font-semibold">{item.asset?.code}</div>
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-600 font-medium">
                                                {item.session?.title || '-'}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded-full text-[10px] font-black uppercase",
                                                    item.status === 'FOUND' ? "bg-emerald-50 text-emerald-700" :
                                                    item.status === 'MISSING' ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"
                                                )}>
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 font-semibold text-slate-700">
                                                {item.foundCondition || '-'}
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-600">
                                                {item.auditor?.name || '-'}
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-500">
                                                {item.verifiedAt ? new Date(item.verifiedAt).toLocaleDateString('id-ID') : '-'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* TAB CONTENT: LOANS */}
                {activeTab === 'loans' && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider">
                                <tr>
                                    <th className="px-5 py-3.5">Aset</th>
                                    <th className="px-5 py-3.5">Peminjam</th>
                                    <th className="px-5 py-3.5">Unit Tujuan</th>
                                    <th className="px-5 py-3.5">Tgl Pinjam</th>
                                    <th className="px-5 py-3.5">Est. Kembali</th>
                                    <th className="px-5 py-3.5">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {details.loans.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-5 py-8 text-center text-slate-400 font-semibold">
                                            Tidak ada peminjaman aset pada periode ini.
                                        </td>
                                    </tr>
                                ) : (
                                    details.loans.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="px-5 py-3.5">
                                                <div className="font-bold text-slate-800">{item.asset?.name}</div>
                                                <div className="text-[10px] text-violet-600 font-mono font-semibold">{item.asset?.code}</div>
                                            </td>
                                            <td className="px-5 py-3.5 font-semibold text-slate-700">
                                                {item.borrower?.name || '-'}
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-600">
                                                {item.targetUnit?.name || '-'}
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-500">
                                                {item.borrowDate ? new Date(item.borrowDate).toLocaleDateString('id-ID') : '-'}
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-500">
                                                {item.expectedReturnDate ? new Date(item.expectedReturnDate).toLocaleDateString('id-ID') : '-'}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded-full text-[10px] font-black uppercase",
                                                    item.status === 'BORROWED' ? "bg-amber-50 text-amber-700" :
                                                    item.status === 'RETURNED' ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                                                )}>
                                                    {item.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* TAB CONTENT: DISPOSALS */}
                {activeTab === 'disposals' && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider">
                                <tr>
                                    <th className="px-5 py-3.5">Aset</th>
                                    <th className="px-5 py-3.5">Alasan</th>
                                    <th className="px-5 py-3.5">Metode</th>
                                    <th className="px-5 py-3.5">Pengusul</th>
                                    <th className="px-5 py-3.5">Status</th>
                                    <th className="px-5 py-3.5">Tgl Pengajuan</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {details.disposals.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-5 py-8 text-center text-slate-400 font-semibold">
                                            Tidak ada usulan penghapusan aset pada periode ini.
                                        </td>
                                    </tr>
                                ) : (
                                    details.disposals.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="px-5 py-3.5">
                                                <div className="font-bold text-slate-800">{item.asset?.name}</div>
                                                <div className="text-[10px] text-rose-600 font-mono font-semibold">{item.asset?.code}</div>
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-700 font-medium">
                                                {item.reason || '-'}
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-600">
                                                {item.method || '-'}
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-600">
                                                {item.proposedBy?.name || '-'}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded-full text-[10px] font-black uppercase",
                                                    item.status === 'APPROVED' ? "bg-emerald-50 text-emerald-700" :
                                                    item.status === 'REJECTED' ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"
                                                )}>
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-500">
                                                {new Date(item.createdAt).toLocaleDateString('id-ID')}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* 4. OFFICIAL PRINTABLE REPORT CONTAINER (VISIBLE IN PRINT OR PREVIEW MODE) */}
            <div className={cn(
                "bg-white rounded-3xl border border-slate-200 shadow-sm p-8 md:p-12 space-y-8 max-w-4xl mx-auto text-slate-800 print:border-none print:shadow-none print:p-0 print:block print:max-w-none print:w-full print:m-0",
                showPrintPreview ? "block" : "hidden print:block"
            )}>
                {/* KOP SURAT RESMI */}
                <div className="text-center border-b-2 border-slate-800 pb-4 space-y-1">
                    <h2 className="text-xl font-black tracking-wider text-slate-900 uppercase">YAYASAN DAR EL-IMAN PADANG</h2>
                    <h3 className="text-base font-black text-indigo-950 uppercase tracking-widest">BIDANG SARANA & PRASARANA</h3>
                    <p className="text-[11px] text-slate-600">Jl. Gunuang Juaro, Surau Gadang, Kec. Nanggalo, Kota Padang, Sumatera Barat</p>
                </div>

                {/* JUDUL LAPORAN */}
                <div className="text-center space-y-1">
                    <h4 className="text-sm font-black uppercase tracking-wider underline">LAPORAN OPERASIONAL & PERGERAKAN ASET MINGGUAN</h4>
                    <p className="text-xs font-bold text-slate-600">
                        Periode: {data?.period?.formattedPeriod || '-'}
                    </p>
                    <p className="text-[11px] font-medium text-slate-500">
                        Lingkup Unit: {data?.unit || 'Seluruh Unit'}
                    </p>
                </div>

                {/* I. REKAPITULASI METRIK */}
                <div className="space-y-2">
                    <h5 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
                        I. Ringkasan Rekapitulasi Metrik Aset
                    </h5>
                    <table className="w-full text-xs border border-slate-300 mt-2">
                        <thead className="bg-slate-100 font-bold text-slate-700">
                            <tr>
                                <th className="border border-slate-300 px-3 py-2 text-center w-12">No</th>
                                <th className="border border-slate-300 px-3 py-2 text-left">Indikator Kinerja / Aktivitas</th>
                                <th className="border border-slate-300 px-3 py-2 text-center w-28">Jumlah</th>
                                <th className="border border-slate-300 px-3 py-2 text-right w-44">Keterangan / Estimasi Nilai</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="border border-slate-300 px-3 py-1.5 text-center">1</td>
                                <td className="border border-slate-300 px-3 py-1.5 font-medium">Aset Baru Masuk (Pengadaan / Registrasi)</td>
                                <td className="border border-slate-300 px-3 py-1.5 text-center font-bold">{summary.newAssetsCount} item</td>
                                <td className="border border-slate-300 px-3 py-1.5 text-right font-semibold">Rp {summary.newAssetsValue.toLocaleString('id-ID')}</td>
                            </tr>
                            <tr>
                                <td className="border border-slate-300 px-3 py-1.5 text-center">2</td>
                                <td className="border border-slate-300 px-3 py-1.5 font-medium">Mutasi & Perpindahan Ruangan/Unit</td>
                                <td className="border border-slate-300 px-3 py-1.5 text-center font-bold">{summary.movementsCount} transaksi</td>
                                <td className="border border-slate-300 px-3 py-1.5 text-right text-slate-500">Relokasi sarana</td>
                            </tr>
                            <tr>
                                <td className="border border-slate-300 px-3 py-1.5 text-center">3</td>
                                <td className="border border-slate-300 px-3 py-1.5 font-medium">Pemeliharaan & Perbaikan Sarana</td>
                                <td className="border border-slate-300 px-3 py-1.5 text-center font-bold">{summary.maintenanceCount} tiket</td>
                                <td className="border border-slate-300 px-3 py-1.5 text-right font-semibold">Rp {summary.maintenanceCost.toLocaleString('id-ID')}</td>
                            </tr>
                            <tr>
                                <td className="border border-slate-300 px-3 py-1.5 text-center">4</td>
                                <td className="border border-slate-300 px-3 py-1.5 font-medium">Audit & Verifikasi Fisik Aset Lapangan</td>
                                <td className="border border-slate-300 px-3 py-1.5 text-center font-bold">{summary.auditCount} item</td>
                                <td className="border border-slate-300 px-3 py-1.5 text-right text-slate-500">Verifikasi kondisi fisik</td>
                            </tr>
                            <tr>
                                <td className="border border-slate-300 px-3 py-1.5 text-center">5</td>
                                <td className="border border-slate-300 px-3 py-1.5 font-medium">Peminjaman Aset Antar Unit / Luar</td>
                                <td className="border border-slate-300 px-3 py-1.5 text-center font-bold">{summary.loansCount} transaksi</td>
                                <td className="border border-slate-300 px-3 py-1.5 text-right text-slate-500">Peminjaman fasilitas</td>
                            </tr>
                            <tr>
                                <td className="border border-slate-300 px-3 py-1.5 text-center">6</td>
                                <td className="border border-slate-300 px-3 py-1.5 font-medium">Usulan Penghapusan (Disposal / Rusak Berat)</td>
                                <td className="border border-slate-300 px-3 py-1.5 text-center font-bold">{summary.disposalsCount} item</td>
                                <td className="border border-slate-300 px-3 py-1.5 text-right text-slate-500">Usulan lelang/pemusnahan</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* II. REKAPITULASI KUANTITAS ASET BARU */}
                {groupedNewAssets.length > 0 && (
                    <div className="space-y-2">
                        <h5 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
                            II. Rekapitulasi Kuantitas Aset Baru Masuk (Pengadaan)
                        </h5>
                        <table className="w-full text-[11px] border border-slate-300 mt-2">
                            <thead className="bg-slate-100 font-bold text-slate-700">
                                <tr>
                                    <th className="border border-slate-300 px-2 py-1.5 text-center w-8">No</th>
                                    <th className="border border-slate-300 px-3 py-1.5 text-left">Nama Barang / Aset</th>
                                    <th className="border border-slate-300 px-3 py-1.5 text-left w-36">Kategori</th>
                                    <th className="border border-slate-300 px-3 py-1.5 text-left w-40">Unit Penerima</th>
                                    <th className="border border-slate-300 px-2 py-1.5 text-center w-24">Jumlah (Qty)</th>
                                    <th className="border border-slate-300 px-3 py-1.5 text-right w-36">Total Nilai Perolehan</th>
                                </tr>
                            </thead>
                            <tbody>
                                {groupedNewAssets.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="border border-slate-300 px-2 py-1.5 text-center">{idx + 1}</td>
                                        <td className="border border-slate-300 px-3 py-1.5 font-bold text-slate-900">
                                            {item.name}
                                        </td>
                                        <td className="border border-slate-300 px-3 py-1.5 text-slate-600">{item.category}</td>
                                        <td className="border border-slate-300 px-3 py-1.5 text-slate-600">{item.unit}</td>
                                        <td className="border border-slate-300 px-2 py-1.5 text-center font-black text-slate-900">
                                            {item.qty} unit
                                        </td>
                                        <td className="border border-slate-300 px-3 py-1.5 text-right font-bold text-slate-800">
                                            Rp {(item.totalPrice || 0).toLocaleString('id-ID')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-50 font-bold text-slate-800">
                                <tr>
                                    <td colSpan={4} className="border border-slate-300 px-3 py-1.5 text-right uppercase text-[10px]">
                                        Total Pengadaan ({groupedNewAssets.length} Jenis Barang)
                                    </td>
                                    <td className="border border-slate-300 px-2 py-1.5 text-center font-black text-indigo-900">
                                        {summary.newAssetsCount} unit
                                    </td>
                                    <td className="border border-slate-300 px-3 py-1.5 text-right font-black text-indigo-900">
                                        Rp {summary.newAssetsValue.toLocaleString('id-ID')}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}

                {/* III. DETAIL MUTASI */}
                {details.movements.length > 0 && (
                    <div className="space-y-2">
                        <h5 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
                            III. Daftar Mutasi & Perpindahan Aset
                        </h5>
                        <table className="w-full text-[11px] border border-slate-300 mt-2">
                            <thead className="bg-slate-100 font-bold text-slate-700">
                                <tr>
                                    <th className="border border-slate-300 px-2 py-1 text-center w-8">No</th>
                                    <th className="border border-slate-300 px-2 py-1 text-left">Nama Aset</th>
                                    <th className="border border-slate-300 px-2 py-1 text-left">Dari Lokasi</th>
                                    <th className="border border-slate-300 px-2 py-1 text-left">Menuju Lokasi</th>
                                    <th className="border border-slate-300 px-2 py-1 text-center w-20">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {details.movements.map((item, idx) => (
                                    <tr key={item.id}>
                                        <td className="border border-slate-300 px-2 py-1 text-center">{idx + 1}</td>
                                        <td className="border border-slate-300 px-2 py-1 font-bold">{item.asset?.name || '-'}</td>
                                        <td className="border border-slate-300 px-2 py-1">{item.fromLocation || '-'}</td>
                                        <td className="border border-slate-300 px-2 py-1 font-semibold">{item.toLocation || '-'}</td>
                                        <td className="border border-slate-300 px-2 py-1 text-center font-bold">{item.status}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* IV. DETAIL PEMELIHARAAN */}
                {details.maintenances.length > 0 && (
                    <div className="space-y-2">
                        <h5 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
                            IV. Daftar Pemeliharaan & Servis Sarana
                        </h5>
                        <table className="w-full text-[11px] border border-slate-300 mt-2">
                            <thead className="bg-slate-100 font-bold text-slate-700">
                                <tr>
                                    <th className="border border-slate-300 px-2 py-1 text-center w-8">No</th>
                                    <th className="border border-slate-300 px-2 py-1 text-left">Judul Pemeliharaan</th>
                                    <th className="border border-slate-300 px-2 py-1 text-left">Unit</th>
                                    <th className="border border-slate-300 px-2 py-1 text-center w-20">Status</th>
                                    <th className="border border-slate-300 px-2 py-1 text-right w-24">Biaya</th>
                                </tr>
                            </thead>
                            <tbody>
                                {details.maintenances.map((item, idx) => (
                                    <tr key={item.id}>
                                        <td className="border border-slate-300 px-2 py-1 text-center">{idx + 1}</td>
                                        <td className="border border-slate-300 px-2 py-1">
                                            <div className="font-bold">{item.title}</div>
                                            <div className="text-[10px] text-slate-400">{item.code}</div>
                                        </td>
                                        <td className="border border-slate-300 px-2 py-1">{item.unit?.name || '-'}</td>
                                        <td className="border border-slate-300 px-2 py-1 text-center font-bold">{item.status}</td>
                                        <td className="border border-slate-300 px-2 py-1 text-right font-bold">
                                            Rp {(item.cost || 0).toLocaleString('id-ID')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* BLOK TANDA TANGAN RESMI */}
                <div className="pt-6 grid grid-cols-2 gap-8 text-center text-xs">
                    <div>
                        <p className="font-semibold text-slate-600">Dibuat Oleh,</p>
                        <p className="text-[11px] text-slate-500 mb-16">{data?.signers?.staff?.position || 'Staff Manajemen Aset'}</p>
                        <p className="font-black text-slate-900 underline uppercase">{data?.signers?.staff?.name || 'Staff Manajemen Aset'}</p>
                        <p className="text-[10px] text-slate-500 font-mono">NIY: {data?.signers?.staff?.niy || '-'}</p>
                    </div>
                    <div>
                        <p className="font-semibold text-slate-600">Mengetahui,</p>
                        <p className="text-[11px] text-slate-500 mb-16">Kepala Bidang Sarana & Prasarana</p>
                        <p className="font-black text-slate-900 underline uppercase">{data?.signers?.kabid?.name || 'Ravi Kurnia'}</p>
                        <p className="text-[10px] text-slate-500 font-mono">NIY: {data?.signers?.kabid?.niy || '-'}</p>
                    </div>
                </div>

                <div className="text-[10px] text-center text-slate-400 border-t border-slate-200 pt-3">
                    Dokumen dicetak otomatis melalui Sistem Informasi Manajemen Aset & Sarpras Yayasan Dar El-Iman Padang
                </div>
            </div>
        </div>
    );
}
