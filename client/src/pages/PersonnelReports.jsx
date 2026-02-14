import { useState, useEffect } from 'react';
import { FileText, Plus, Calendar, ChevronRight, CheckCircle2, Trash2, Sparkles, X } from 'lucide-react';
import api from '../lib/axios';

const PersonnelReports = () => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    // const [typeFilter, setTypeFilter] = useState('ALL'); // Removed filter
    const [showForm, setShowForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);

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
        // Specialized fields
        finance: { income: '', outcome: '', balance: '' },
        assets: {
            activityType: 'DISTRIBUSI',
            items: [{ name: '', qty: '', target: '' }],
            checks: { bast: false, photo: false, database: false }
        },
        warehouse: { in: '', out: '', remaining: '' },
        vehicle: { kmStart: '', kmEnd: '', fuel: '', condition: 'BAIK' },
        // New fields for generic report
        startTime: '08:00',
        endTime: '17:00',
        generalItems: [{ activity: '', status: 'SELESAI' }]
    });

    const user = JSON.parse(localStorage.getItem('user')) || {};

    const fetchReports = async () => {
        try {
            setLoading(true);
            const params = { type: 'DAILY' }; // Force DAILY
            const res = await api.get('/personnel/reports', { params });
            // Ensure data is array to prevent crash
            const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            setReports(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, []); // Run once on mount

    const addAssetItem = () => {
        setForm({
            ...form,
            assets: { ...form.assets, items: [...form.assets.items, { name: '', qty: '', target: '' }] }
        });
    };

    const removeAssetItem = (index) => {
        const newItems = form.assets.items.filter((_, i) => i !== index);
        setForm({ ...form, assets: { ...form.assets, items: newItems } });
    };

    const addGeneralItem = () => {
        setForm({
            ...form,
            generalItems: [...form.generalItems, { activity: '', status: 'SELESAI' }]
        });
    };

    const removeGeneralItem = (index) => {
        const newItems = form.generalItems.filter((_, i) => i !== index);
        setForm({ ...form, generalItems: newItems });
    };

    const handleGeneralItemChange = (index, field, value) => {
        const newItems = [...form.generalItems];
        newItems[index][field] = value;
        setForm({ ...form, generalItems: newItems });
    };

    const generateSummary = () => {
        if (!summaryDate.start || !summaryDate.end) return alert('Pilih rentang tanggal terlebih dahulu');

        setIsGenerating(true);
        setSummaryResult('');

        setTimeout(() => {
            // Filter reports client-side
            const start = new Date(summaryDate.start);
            const end = new Date(summaryDate.end);
            end.setHours(23, 59, 59); // Include end date fully

            const filtered = reports.filter(r => {
                const d = new Date(r.date);
                return d >= start && d <= end;
            });

            if (filtered.length === 0) {
                setSummaryResult('❌ Tidak ada laporan ditemukan pada rentang tanggal tersebut.');
                setIsGenerating(false);
                return;
            }

            // Group by User
            const grouped = {};
            filtered.forEach(r => {
                const name = r.user?.name || r.user?.username || 'Unknown';
                if (!grouped[name]) grouped[name] = { count: 0, activities: [] };
                grouped[name].count++;

                // Collect activities
                if (r.metadata?.items && Array.isArray(r.metadata.items)) {
                    r.metadata.items.forEach(item => {
                        if (item.name && item.name.trim()) grouped[name].activities.push(item.name.trim());
                    });
                }

                // Fallback to content if no items but content exists
                if (r.content && (!r.metadata?.items || r.metadata.items.length === 0)) {
                    grouped[name].activities.push(r.content.trim());
                }
            });

            // Format Output
            let text = `🤖 **Rangkuman Aktivitas Staff (AI Generated)**\n`;
            text += `📅 Periode: ${new Date(summaryDate.start).toLocaleDateString('id-ID')} s/d ${new Date(summaryDate.end).toLocaleDateString('id-ID')}\n`;
            text += `📊 Total Laporan: ${filtered.length}\n\n`;

            Object.entries(grouped).forEach(([name, data], index) => {
                const uniqueActivities = [...new Set(data.activities)];
                text += `${index + 1}. **${name}** (${data.count} Hari Kerja)\n`;
                if (uniqueActivities.length > 0) {
                    text += uniqueActivities.map(a => `   • ${a}`).join('\n');
                } else {
                    text += `   • (Tidak ada detail aktivitas)`;
                }
                text += '\n\n';
            });

            setSummaryResult(text);
            setIsGenerating(false);
        }, 1500); // Simulation delay
    };

    const handleAssetItemChange = (index, field, value) => {
        const newItems = [...form.assets.items];
        newItems[index][field] = value;
        setForm({ ...form, assets: { ...form.assets, items: newItems } });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        let details = '';
        let metadata = null;

        // Force category to UMUM for DAILY reports in this simplified version
        // Logic for Generic/General reports
        if (form.generalItems.length > 0 && form.generalItems[0].activity) {
            const itemsList = form.generalItems
                .filter(it => it.activity.trim())
                .map(it => `- ${it.activity} [${it.status}]`)
                .join('\n');
            details = `🕒 *Jam Kerja*: ${form.startTime} - ${form.endTime}\n📋 *Aktivitas*:\n${itemsList}`;

            metadata = {
                startTime: form.startTime,
                endTime: form.endTime,
                // Map to 'items' structure so existing display logic works (name=activity, qty=status)
                items: form.generalItems.filter(it => it.activity.trim()).map(it => ({
                    name: it.activity,
                    qty: it.status,
                    target: ''
                }))
            };
        } else {
            // Fallback for simple textarea
            details = `🕒 *Jam Kerja*: ${form.startTime} - ${form.endTime}\n📝 ${form.content}`;
            metadata = { startTime: form.startTime, endTime: form.endTime };
        }

        if (!form.content.trim() && !details) return alert('Isi laporan tidak boleh kosong');

        try {
            setSubmitting(true);
            await api.post('/personnel/reports', {
                ...form,
                type: 'DAILY', // Ensure type is DAILY
                category: 'UMUM', // Ensure category is UMUM
                details: details.replace(/\*/g, ''), // Send clean text to backend
                metadata
            });
            setShowForm(false);
            setForm({
                type: 'DAILY',
                category: 'UMUM',
                content: '',
                date: new Date().toISOString().split('T')[0],
                finance: { income: '', outcome: '', balance: '' },
                assets: {
                    activityType: 'DISTRIBUSI',
                    items: [{ name: '', qty: '', target: '' }],
                    checks: { bast: false, photo: false, database: false }
                },
                warehouse: { in: '', out: '', remaining: '' },
                vehicle: { kmStart: '', kmEnd: '', fuel: '', condition: 'BAIK' },
                startTime: '08:00',
                endTime: '17:00',
                generalItems: [{ activity: '', status: 'SELESAI' }]
            });
            fetchReports();
            alert('Laporan berhasil dikirim');
        } catch (err) {
            alert(err.response?.data?.error || 'Gagal mengirim laporan');
        } finally {
            setSubmitting(false);
        }
    };

    const filteredReports = reports.filter(report => typeFilter === 'ALL' || report.type === typeFilter);

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FileText className="text-blue-600" /> Laporan Harian
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Input laporan kinerja harian staf Sarpras
                    </p>
                </div>
            </div>
            <div className="flex gap-2">
                <button
                    onClick={() => setShowSummaryModal(true)}
                    className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2.5 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all text-sm hover:bg-purple-700"
                >
                    <Sparkles size={18} /> Rangkum AI
                </button>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all text-sm"
                >
                    {showForm ? 'Batal' : <><Plus size={18} /> Buat Laporan</>}
                </button>
            </div>

            {
                showForm && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">Input Laporan Harian</h3>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tanggal</label>
                                    <input
                                        type="date"
                                        value={form.date}
                                        onChange={e => setForm({ ...form, date: e.target.value })}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Dari Jam</label>
                                    <input
                                        type="time"
                                        value={form.startTime}
                                        onChange={e => setForm({ ...form, startTime: e.target.value })}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Sampai Jam</label>
                                    <input
                                        type="time"
                                        value={form.endTime}
                                        onChange={e => setForm({ ...form, endTime: e.target.value })}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </div>

                            {/* Always show General Activity Input */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-semibold text-slate-700">Daftar Aktivitas / Pekerjaan</label>
                                    <button type="button" onClick={addGeneralItem} className="text-blue-600 hover:text-blue-700 text-xs font-bold flex items-center gap-1">
                                        <Plus size={14} /> Tambah Aktivitas
                                    </button>
                                </div>
                                <div className="space-y-3 mb-4">
                                    {form.generalItems.map((item, idx) => (
                                        <div key={idx} className="flex gap-2 items-start">
                                            <div className="flex-1">
                                                <input
                                                    placeholder="Deskripsi Aktivitas"
                                                    value={item.activity}
                                                    onChange={e => handleGeneralItemChange(idx, 'activity', e.target.value)}
                                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                            <div className="w-32">
                                                <select
                                                    value={item.status}
                                                    onChange={e => handleGeneralItemChange(idx, 'status', e.target.value)}
                                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-600"
                                                >
                                                    <option value="SELESAI">SELESAI</option>
                                                    <option value="PROSES">PROSES</option>
                                                    <option value="PENDING">PENDING</option>
                                                </select>
                                            </div>
                                            {form.generalItems.length > 1 && (
                                                <button type="button" onClick={() => removeGeneralItem(idx)} className="p-2.5 text-red-500 hover:bg-red-50 rounded-lg">
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Catatan Tambahan (Opsional)</label>
                                <textarea
                                    value={form.content}
                                    onChange={e => setForm({ ...form, content: e.target.value })}
                                    rows={2}
                                    placeholder="Catatan lain atau kendala yang dihadapi..."
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                ></textarea>
                            </div>
                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="bg-blue-600 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50 shadow-lg shadow-blue-600/20"
                                >
                                    {submitting ? 'Mengirim...' : 'Kirim Laporan'}
                                </button>
                            </div>
                        </form>
                    </div>
                )
            }

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="divide-y divide-slate-100">
                    {loading ? (
                        <div className="p-10 text-center text-slate-400">Memuat laporan...</div>
                    ) : reports.length === 0 ? (
                        <div className="p-10 text-center text-slate-400">
                            <FileText size={40} className="mx-auto mb-2 text-slate-300" />
                            Belum ada laporan yang dikirimkan.
                        </div>
                    ) : (
                        reports.map(report => {
                            try {
                                return (
                                    <div key={report.id} className="p-4 hover:bg-slate-50 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm bg-blue-500">
                                                    H
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-800">{report.user?.name || report.user?.username || 'Unknown'}</div>
                                                    <div className="text-[10px] text-slate-500 flex items-center gap-1">
                                                        <Calendar size={12} /> {new Date(report.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                                        {report.metadata?.startTime && report.metadata?.endTime && (
                                                            <span className="ml-2 px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 font-mono">
                                                                {report.metadata.startTime} - {report.metadata.endTime}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">
                                                HARIAN
                                            </span>
                                        </div>
                                        <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 whitespace-pre-wrap">
                                            {report.content}
                                            {Array.isArray(report.metadata?.items) && report.metadata.items.length > 0 && (
                                                <div className="mt-3 pt-3 border-t border-slate-200">
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Rincian Pekerjaan:</div>
                                                    <div className="space-y-1">
                                                        {report.metadata.items.map((item, i) => (
                                                            <div key={i} className="text-xs flex items-center gap-2">
                                                                <span className="w-5 h-5 rounded bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[10px]">{i + 1}</span>
                                                                <span className="font-semibold">{item?.name || '-'}</span>
                                                                <span className="text-slate-400">({item?.qty || '-'})</span>
                                                                {item?.target && <span className="text-blue-500 flex items-center gap-1"><ChevronRight size={12} /> {item.target}</span>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {report.metadata.checks && (
                                                        <div className="mt-3 flex flex-wrap gap-2">
                                                            {report.metadata.checks.bast && <span className="px-1.5 py-0.5 bg-green-50 text-green-600 rounded text-[9px] font-bold border border-green-100 flex items-center gap-1"><CheckCircle2 size={10} /> BAST</span>}
                                                            {report.metadata.checks.photo && <span className="px-1.5 py-0.5 bg-green-50 text-green-600 rounded text-[9px] font-bold border border-green-100 flex items-center gap-1"><CheckCircle2 size={10} /> FOTO</span>}
                                                            {report.metadata.checks.database && <span className="px-1.5 py-0.5 bg-green-50 text-green-600 rounded text-[9px] font-bold border border-green-100 flex items-center gap-1"><CheckCircle2 size={10} /> DATABASE</span>}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="mt-2 text-[10px] text-slate-400 text-right">
                                            Dikirim pada {new Date(report.createdAt).toLocaleString('id-ID')}
                                        </div>
                                    </div>
                                );
                            } catch (error) {
                                console.error('Error rendering report:', error, report);
                                return (
                                    <div key={report.id || Math.random()} className="p-4 bg-red-50 text-red-500 border-b border-red-100 text-xs">
                                        Error menampilkan laporan. ID: {report.id}
                                    </div>
                                );
                            }
                        })
                    )}
                </div>
            </div>

            {/* AI Summary Modal */}
            {
                showSummaryModal && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-purple-50">
                                <h3 className="text-lg font-bold text-purple-900 flex items-center gap-2">
                                    <Sparkles className="text-purple-600" /> Assistant Rangkuman AI
                                </h3>
                                <button onClick={() => setShowSummaryModal(false)} className="p-2 hover:bg-white/50 rounded-full text-slate-500 hover:text-red-500 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto custom-scrollbar">
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
                                    <label className="block text-sm font-semibold text-slate-700 mb-3">Pilih Rentang Tanggal</label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <div className="text-xs text-slate-500 mb-1">Dari Tanggal</div>
                                            <input
                                                type="date"
                                                value={summaryDate.start}
                                                onChange={e => setSummaryDate({ ...summaryDate, start: e.target.value })}
                                                className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                            />
                                        </div>
                                        <div>
                                            <div className="text-xs text-slate-500 mb-1">Sampai Tanggal</div>
                                            <input
                                                type="date"
                                                value={summaryDate.end}
                                                onChange={e => setSummaryDate({ ...summaryDate, end: e.target.value })}
                                                className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={generateSummary}
                                        disabled={isGenerating || !summaryDate.start || !summaryDate.end}
                                        className="w-full mt-4 bg-purple-600 text-white py-2.5 rounded-xl font-bold hover:bg-purple-700 transition-all shadow-lg flex justify-center items-center gap-2 disabled:opacity-50"
                                    >
                                        {isGenerating ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                Sedang Menganalisa...
                                            </>
                                        ) : (
                                            <>✨ Buat Rangkuman</>
                                        )}
                                    </button>
                                </div>

                                {summaryResult && (
                                    <div className="animate-in slide-in-from-bottom-2 duration-500">
                                        <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                                            <FileText size={16} className="text-purple-600" /> Hasil Rangkuman:
                                        </h4>
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed font-medium">
                                            {summaryResult}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default PersonnelReports;
