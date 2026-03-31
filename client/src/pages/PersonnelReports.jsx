import { useState, useEffect } from 'react';
import { FileText, Plus, Calendar, ChevronRight, CheckCircle2, Trash2, Sparkles, X, Loader2, Send, Filter, Download, Users } from 'lucide-react';
import api from '../lib/axios';

const PersonnelReports = () => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Filter State
    const [filterDate, setFilterDate] = useState({ start: '', end: '' });
    const [filterStaff, setFilterStaff] = useState('all');
    const [limit, setLimit] = useState(25);
    const [staffList, setStaffList] = useState([]);

    // AI Summary State
    const [showSummaryModal, setShowSummaryModal] = useState(false);
    const [summaryDate, setSummaryDate] = useState({ start: '', end: '' });
    const [summaryResult, setSummaryResult] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const [form, setForm] = useState({
        type: 'DAILY',
        category: 'UMUM',
        content: '',
        date: new Date().toISOString().split('T')[0],
        startTime: '08:00',
        endTime: '17:00',
        generalItems: [{ activity: '', status: 'SELESAI', percentage: 100, note: '' }]
    });

    const user = JSON.parse(localStorage.getItem('user')) || {};

    const fetchReports = async () => {
        try {
            setLoading(true);
            const params = {
                type: 'DAILY',
                limit: limit,
                startDate: filterDate.start,
                endDate: filterDate.end,
                userId: filterStaff !== 'all' ? filterStaff : undefined
            };
            const res = await api.get('/personnel/reports', { params });
            const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            setReports(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchStaff = async () => {
        if (!['SUPER_ADMIN', 'ADMIN_ASET', 'BIDANG_IT'].includes(user.role)) return;
        try {
            const res = await api.get('/personnel/staff');
            setStaffList(res.data || []);
        } catch (err) {
            console.error('Failed to fetch staff:', err);
        }
    };

    useEffect(() => {
        fetchReports();
    }, [limit, filterDate.start, filterDate.end, filterStaff]);

    useEffect(() => {
        fetchStaff();
    }, []);

    const addGeneralItem = () => {
        setForm({
            ...form,
            generalItems: [...form.generalItems, { activity: '', status: 'SELESAI', percentage: 100, note: '' }]
        });
    };

    const removeGeneralItem = (index) => {
        const newItems = form.generalItems.filter((_, i) => i !== index);
        setForm({ ...form, generalItems: newItems });
    };

    const handleGeneralItemChange = (index, field, value) => {
        const newItems = [...form.generalItems];
        newItems[index][field] = value;
        if (field === 'status' && value === 'SELESAI') {
            newItems[index].percentage = 100;
        }
        setForm({ ...form, generalItems: newItems });
    };

    const handleCopySummary = () => {
        if (!summaryResult) return;
        navigator.clipboard.writeText(summaryResult.replace(/\*\*/g, ''));
        alert('Rangkuman berhasil disalin ke clipboard!');
    };

    const generateAISummary = async () => {
        if (!summaryDate.start || !summaryDate.end) return alert('Pilih rentang tanggal terlebih dahulu');

        setIsGenerating(true);
        setSummaryResult('');

        try {
            const res = await api.get('/personnel/reports/ai-summary', {
                params: {
                    startDate: summaryDate.start,
                    endDate: summaryDate.end
                }
            });

            setSummaryResult(res.data?.summary || 'Gagal mendapatkan rangkuman.');
        } catch (err) {
            console.error('AI Summary Error:', err);
            setSummaryResult('❌ ' + (err.response?.data?.error || 'Gagal menggenerate rangkuman AI. Pastikan GEMINI_API_KEY sudah terkonfigurasi.'));
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const validItems = form.generalItems.filter(it => it.activity.trim());
        if (validItems.length === 0) return alert('Input minimal satu aktivitas');

        try {
            setSubmitting(true);
            const itemsList = validItems
                .map(it => {
                    const progress = it.status !== 'SELESAI' ? ` [${it.percentage}%]` : '';
                    const note = it.note ? ` - ${it.note}` : '';
                    return `- ${it.activity} (${it.status})${progress}${note}`;
                })
                .join('\n');

            const details = `🕒 Jam: ${form.startTime}-${form.endTime}\n📋 Aktivitas:\n${itemsList}\n\n📝 Catatan tambahan: ${form.content || '-'}`;

            await api.post('/personnel/reports', {
                ...form,
                details: details.replace(/\*/g, ''),
                metadata: {
                    startTime: form.startTime,
                    endTime: form.endTime,
                    items: validItems
                }
            });

            setShowForm(false);
            setForm({
                type: 'DAILY',
                category: 'UMUM',
                content: '',
                date: new Date().toISOString().split('T')[0],
                startTime: '08:00',
                endTime: '17:00',
                generalItems: [{ activity: '', status: 'SELESAI', percentage: 100, note: '' }]
            });
            fetchReports();
            alert('Laporan berhasil dikirim');
        } catch (err) {
            alert(err.response?.data?.error || 'Gagal mengirim laporan');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 p-4 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                            <FileText size={28} />
                        </div>
                        Laporan Harian Staf
                    </h1>
                    <p className="text-slate-500 text-sm mt-2 font-medium">Monitoring akuntabilitas dan progres kerja harian tim Sarana dan Prasarana.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => setShowSummaryModal(true)}
                        className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-slate-900/20 hover:bg-slate-800 transition-all active:scale-95"
                    >
                        <Sparkles size={18} className="text-amber-400" /> Analisa AI
                    </button>
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold shadow-lg transition-all active:scale-95 ${showForm ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-indigo-600 text-white shadow-indigo-600/20 hover:bg-indigo-700'}`}
                    >
                        {showForm ? <><X size={18} /> Batal</> : <><Plus size={18} /> Buat Laporan</>}
                    </button>
                </div>
            </div>

            {/* Filter Section */}
            {!showForm && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50/50 p-6 rounded-3xl border border-slate-200/60 backdrop-blur-sm">
                    {['SUPER_ADMIN', 'ADMIN_ASET', 'BIDANG_IT'].includes(user.role) && (
                        <div className="md:col-span-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Filter Staf</label>
                            <div className="relative">
                                <Users size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <select
                                    value={filterStaff}
                                    onChange={e => setFilterStaff(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none cursor-pointer"
                                >
                                    <option value="all">Semua Anggota</option>
                                    {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                        </div>
                    )}
                    <div className="md:col-span-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Rentang Tanggal</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={filterDate.start}
                                onChange={e => setFilterDate({ ...filterDate, start: e.target.value })}
                                className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                            />
                            <span className="text-slate-400 font-bold">s/d</span>
                            <input
                                type="date"
                                value={filterDate.end}
                                onChange={e => setFilterDate({ ...filterDate, end: e.target.value })}
                                className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Input Form Section */}
            {showForm && (
                <div className="bg-white rounded-3xl border border-indigo-100 p-8 shadow-xl shadow-indigo-100/50 animate-in slide-in-from-top-6 duration-500">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
                            <Plus size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">Form Laporan Aktivitas</h3>
                            <p className="text-sm text-slate-500 font-medium">Pastikan semua data terisi dengan akurat sesuai jam operasional.</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase px-1">📅 Tanggal</label>
                                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase px-1">🕒 Mulai Jam</label>
                                <input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase px-1">🕒 Selesai Jam</label>
                                <input type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center px-1">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">📋 Rincian Pekerjaan</label>
                                <button type="button" onClick={addGeneralItem} className="text-indigo-600 hover:text-indigo-700 text-xs font-bold flex items-center gap-1.5 bg-indigo-50 px-3 py-1.5 rounded-full transition-all">
                                    <Plus size={14} /> Tambah Item
                                </button>
                            </div>
                            
                            <div className="space-y-4">
                                {form.generalItems.map((item, idx) => (
                                    <div key={idx} className="p-6 bg-slate-50/50 rounded-2xl border border-slate-200/60 space-y-4 relative group hover:border-indigo-200 transition-all">
                                        <div className="flex flex-col md:flex-row gap-4">
                                            <div className="flex-1">
                                                <input
                                                    placeholder="Contoh: Perbaikan AC Ruang Aula Utama"
                                                    value={item.activity}
                                                    onChange={e => handleGeneralItemChange(idx, 'activity', e.target.value)}
                                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                                                />
                                            </div>
                                            <div className="w-full md:w-48">
                                                <select
                                                    value={item.status}
                                                    onChange={e => handleGeneralItemChange(idx, 'status', e.target.value)}
                                                    className={`w-full px-4 py-3 border rounded-xl text-sm font-extrabold outline-none shadow-sm appearance-none cursor-pointer flex items-center justify-center text-center ${item.status === 'SELESAI' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-amber-50 border-amber-100 text-amber-600'}`}
                                                >
                                                    <option value="SELESAI">TELAH SELESAI</option>
                                                    <option value="PROSES">DALAM PROSES</option>
                                                    <option value="PENDING">TERTUNDA</option>
                                                </select>
                                            </div>
                                            {form.generalItems.length > 1 && (
                                                <button type="button" onClick={() => removeGeneralItem(idx)} className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                                                    <Trash2 size={20} />
                                                </button>
                                            )}
                                        </div>

                                        <div className="flex flex-col md:flex-row gap-6 items-center px-1">
                                            {item.status !== 'SELESAI' && (
                                                <div className="w-full md:w-64 flex items-center gap-4">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Progres Kerja</span>
                                                    <input
                                                        type="range" min="0" max="100" step="10"
                                                        value={item.percentage}
                                                        onChange={e => handleGeneralItemChange(idx, 'percentage', e.target.value)}
                                                        className="flex-1 h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-indigo-600"
                                                    />
                                                    <span className="text-sm font-black text-indigo-600 w-10 text-right">{item.percentage}%</span>
                                                </div>
                                            )}
                                            <div className="flex-1 w-full">
                                                <input
                                                    placeholder="Catatan kendala atau hasil khusus..."
                                                    value={item.note || ''}
                                                    onChange={e => handleGeneralItemChange(idx, 'note', e.target.value)}
                                                    className="w-full px-3 py-2 bg-white/50 border border-slate-200 rounded-lg text-xs font-medium italic outline-none focus:ring-1 focus:ring-indigo-500"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-2 pt-4">
                                <label className="text-xs font-black text-slate-500 uppercase px-1">📝 Catatan Umum Tambahan</label>
                                <textarea
                                    value={form.content}
                                    onChange={e => setForm({ ...form, content: e.target.value })}
                                    rows={3}
                                    placeholder="Masukkan informasi lain yang perlu diketahui pimpinan..."
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                ></textarea>
                            </div>
                        </div>

                        <div className="flex justify-end pt-6 border-t border-slate-100">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="flex items-center gap-2 bg-indigo-600 text-white px-10 py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-xl shadow-indigo-600/30 active:scale-95"
                            >
                                {submitting ? <Loader2 className="animate-spin" /> : <Send size={18} />}
                                {submitting ? 'Mengirim Data...' : 'Kirim Laporan Resmi'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Reports List Section */}
            {!showForm && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Filter size={14} /> Riwayat Aktivitas
                        </h3>
                        <span className="text-xs font-bold text-slate-400">{reports.length} Laporan Ditemukan</span>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center p-20 space-y-4 bg-white rounded-3xl border border-slate-100">
                            <Loader2 className="animate-spin text-indigo-600" size={40} />
                            <p className="text-slate-400 font-bold animate-pulse">Menyiapkan Laporan...</p>
                        </div>
                    ) : reports.length === 0 ? (
                        <div className="p-20 text-center bg-white rounded-3xl border border-slate-200 border-dashed">
                            <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <FileText size={32} />
                            </div>
                            <h4 className="text-lg font-bold text-slate-800">Data Tidak Ditemukan</h4>
                            <p className="text-slate-400 text-sm max-w-xs mx-auto mt-1">Belum ada laporan aktivitas yang tercatat untuk kriteria filter saat ini.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {reports.map((report) => (
                                <div key={report.id} className="group bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-300 overflow-hidden relative">
                                    <div className="flex flex-col md:flex-row justify-between gap-6 relative z-10">
                                        <div className="flex items-start gap-5">
                                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center font-black text-xl shadow-lg ring-4 ring-indigo-50">
                                                {(report.user?.name || report.user?.username || 'S')[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <h4 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{report.user?.name || report.user?.username || 'Unknown Staff'}</h4>
                                                <div className="flex flex-wrap items-center gap-4 mt-1.5">
                                                    <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg">
                                                        <Calendar size={12} className="text-indigo-500" />
                                                        {new Date(report.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
                                                    </span>
                                                    {report.metadata?.startTime && (
                                                        <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                                                            <Loader2 size={12} className="animate-spin-slow" />
                                                            {report.metadata.startTime} - {report.metadata.endTime}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest rounded-full border border-emerald-100">Verified</span>
                                        </div>
                                    </div>

                                    <div className="mt-8 space-y-4 relative z-10">
                                        {Array.isArray(report.metadata?.items) && report.metadata.items.length > 0 && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {report.metadata.items.map((item, i) => (
                                                    <div key={i} className="flex flex-col p-4 bg-slate-50/70 border border-slate-100 rounded-2xl hover:bg-white hover:shadow-md transition-all">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="flex items-start gap-3">
                                                                <div className="mt-1">
                                                                    <div className={`w-2 h-2 rounded-full ${item.qty === 'SELESAI' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'}`} />
                                                                </div>
                                                                <span className="text-sm font-bold text-slate-700 leading-tight">{item.name}</span>
                                                            </div>
                                                            <span className={`flex-shrink-0 px-2 py-0.5 rounded-lg text-[9px] font-black tracking-tighter ${item.qty === 'SELESAI' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
                                                                {item.qty === 'SELESAI' ? 'CLOSED' : `${item.percentage || 0}%`}
                                                            </span>
                                                        </div>
                                                        {item.note && <p className="mt-2 text-[10px] text-slate-400 font-medium italic border-l-2 border-slate-200 pl-2 ml-1">{item.note}</p>}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {report.content && (
                                            <div className="p-4 bg-indigo-50/30 rounded-2xl border border-indigo-50 border-dashed text-sm text-slate-600 font-medium leading-relaxed italic">
                                                "{report.content}"
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-6 pt-4 border-t border-slate-50 flex justify-between items-center text-[10px] font-bold text-slate-300 relative z-10 tracking-widest uppercase px-1">
                                        <span>Personnel Report System</span>
                                        <span>System UID: #{report.id.toString().padStart(5, '0')}</span>
                                    </div>
                                    
                                    {/* Subtle background icon */}
                                    <FileText className="absolute right-[-20px] bottom-[-20px] w-48 h-48 text-slate-50 group-hover:text-indigo-50 transition-colors duration-700 rotate-12" />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* AI Summary Modal */}
            {showSummaryModal && (
                <div className="fixed inset-0 bg-slate-900/40 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white rounded-[40px] w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl relative">
                        <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-gradient-to-r from-slate-900 to-indigo-900 text-white">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center box-border border border-white/20">
                                    <Sparkles className="text-amber-400 animate-pulse" size={26} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black tracking-tight">Intelligence Executive Summary</h3>
                                    <p className="text-indigo-300 text-[10px] font-bold uppercase tracking-widest mt-0.5">Powered by Google Gemini 1.5</p>
                                </div>
                            </div>
                            <button onClick={() => setShowSummaryModal(false)} className="w-10 h-10 bg-white/10 hover:bg-red-500 rounded-full flex items-center justify-center transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-8 overflow-y-auto custom-scrollbar space-y-8">
                            <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-200/60 shadow-inner">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4 px-1">Konfigurasi Periode Analisa</label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1.5">
                                        <div className="text-[10px] font-bold text-slate-500 ml-1 italic">Mulai Dari</div>
                                        <input
                                            type="date"
                                            value={summaryDate.start}
                                            onChange={e => setSummaryDate({ ...summaryDate, start: e.target.value })}
                                            className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-600 outline-none shadow-sm"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="text-[10px] font-bold text-slate-500 ml-1 italic">Hingga Sampai</div>
                                        <input
                                            type="date"
                                            value={summaryDate.end}
                                            onChange={e => setSummaryDate({ ...summaryDate, end: e.target.value })}
                                            className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-600 outline-none shadow-sm"
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={generateAISummary}
                                    disabled={isGenerating || !summaryDate.start || !summaryDate.end}
                                    className="w-full mt-8 bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-indigo-900 transition-all shadow-xl shadow-slate-900/30 flex justify-center items-center gap-3 disabled:opacity-50 active:scale-95"
                                >
                                    {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} className="text-amber-400" />}
                                    {isGenerating ? 'Menghubungkan ke Gemini AI...' : 'Jalankan Analisa Cerdas'}
                                </button>
                            </div>

                            {summaryResult && (
                                <div className="space-y-4 animate-in slide-in-from-bottom-6 duration-700 pb-10">
                                    <div className="flex justify-between items-end px-1">
                                        <div>
                                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                                <FileText size={18} className="text-indigo-600" /> Hasil Analisa Eksekutif
                                            </h4>
                                            <p className="text-[10px] text-slate-400 font-medium mt-1">Data telah diproses secara otomatis oleh sistem AI.</p>
                                        </div>
                                        <button
                                            onClick={handleCopySummary}
                                            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-all active:scale-95"
                                        >
                                            <Download size={14} /> Salin Laporan
                                        </button>
                                    </div>
                                    <div className="bg-slate-50/50 p-8 rounded-[32px] border border-indigo-100 text-sm text-slate-700 leading-relaxed font-semibold whitespace-pre-wrap shadow-inner font-sans selection:bg-indigo-100">
                                        {summaryResult}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PersonnelReports;
