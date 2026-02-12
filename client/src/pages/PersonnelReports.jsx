import { useState, useEffect } from 'react';
import { FileText, Plus, Search, Calendar, ChevronRight, ChevronDown, CheckCircle2, Clock } from 'lucide-react';
import api from '../lib/axios';

const PersonnelReports = () => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState('ALL');
    const [showForm, setShowForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [form, setForm] = useState({
        type: 'DAILY',
        content: '',
        date: new Date().toISOString().split('T')[0]
    });

    const user = JSON.parse(localStorage.getItem('user')) || {};

    const fetchReports = async () => {
        try {
            setLoading(true);
            const params = {};
            if (typeFilter !== 'ALL') params.type = typeFilter;
            const res = await api.get('/personnel/reports', { params });
            setReports(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, [typeFilter]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.content.trim()) return alert('Isi laporan tidak boleh kosong');

        try {
            setSubmitting(true);
            await api.post('/personnel/reports', form);
            setShowForm(false);
            setForm({ type: 'DAILY', content: '', date: new Date().toISOString().split('T')[0] });
            fetchReports();
            alert('Laporan berhasil dikirim');
        } catch (err) {
            alert(err.response?.data?.error || 'Gagal mengirim laporan');
        } finally {
            setSubmitting(false);
        }
    };

    const filteredReports = reports;

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FileText className="text-blue-600" /> Laporan Personalia
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Manajemen laporan harian dan mingguan staf Sarpras
                    </p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all text-sm"
                >
                    {showForm ? 'Batal' : <><Plus size={18} /> Buat Laporan</>}
                </button>
            </div>

            {showForm && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Input Laporan Baru</h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Jenis Laporan</label>
                                <select
                                    value={form.type}
                                    onChange={e => setForm({ ...form, type: e.target.value })}
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="DAILY">Harian</option>
                                    <option value="WEEKLY">Mingguan</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tanggal Aktivitas</label>
                                <input
                                    type="date"
                                    value={form.date}
                                    onChange={e => setForm({ ...form, date: e.target.value })}
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Isi Laporan / Aktivitas</label>
                            <textarea
                                value={form.content}
                                onChange={e => setForm({ ...form, content: e.target.value })}
                                rows={5}
                                placeholder="Jelaskan aktivitas yang dilakukan..."
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            ></textarea>
                        </div>
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                                {submitting ? 'Mengirim...' : 'Kirim Laporan'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        {['ALL', 'DAILY', 'WEEKLY'].map(t => (
                            <button
                                key={t}
                                onClick={() => setTypeFilter(t)}
                                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${typeFilter === t ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                {t === 'ALL' ? 'Semua' : t === 'DAILY' ? 'Harian' : 'Mingguan'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="divide-y divide-slate-100">
                    {loading ? (
                        <div className="p-10 text-center text-slate-400">Memuat laporan...</div>
                    ) : reports.length === 0 ? (
                        <div className="p-10 text-center text-slate-400">
                            <FileText size={40} className="mx-auto mb-2 text-slate-300" />
                            Belum ada laporan yang dikirimkan.
                        </div>
                    ) : (
                        reports.map(report => (
                            <div key={report.id} className="p-4 hover:bg-slate-50 transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${report.type === 'DAILY' ? 'bg-blue-500' : 'bg-purple-500'}`}>
                                            {report.type === 'DAILY' ? 'H' : 'M'}
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-800">{report.user?.name || report.user?.username}</div>
                                            <div className="text-[10px] text-slate-500 flex items-center gap-1">
                                                <Calendar size={12} /> {new Date(report.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                            </div>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${report.type === 'DAILY' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                        {report.type === 'DAILY' ? 'HARIAN' : 'MINGGUAN'}
                                    </span>
                                </div>
                                <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 whitespace-pre-wrap">
                                    {report.content}
                                </div>
                                <div className="mt-2 text-[10px] text-slate-400 text-right">
                                    Dikirim pada {new Date(report.createdAt).toLocaleString('id-ID')}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default PersonnelReports;
