import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { FileText, Calendar, Plus, Save, RefreshCw, Loader2, User } from 'lucide-react';
import api from '../lib/axios';
import dayjs from 'dayjs';

const LaporanStaff = () => {
    const { category } = useParams(); // e.g. 'gudang', 'aset', 'teknisi', 'kendaraan', 'keuangan'
    
    // Map URL param to API category
    const categoryMap = {
        'gudang': 'GUDANG',
        'aset': 'ASET',
        'teknisi': 'UMUM', // Or another mapping if preferred
        'kendaraan': 'KENDARAAN',
        'keuangan': 'KEUANGAN'
    };
    
    const apiCategory = categoryMap[category] || 'UMUM';

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [reports, setReports] = useState([]);
    const [myReport, setMyReport] = useState(null);
    const [autoContent, setAutoContent] = useState('');
    const [manualPoints, setManualPoints] = useState(['']);
    const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));

    const user = JSON.parse(localStorage.getItem('user')) || {};
    const isAdmin = ['SUPER_ADMIN', 'BIDANG_IT', 'ADMIN_ASET', 'KABID_SARPRAS'].includes(user.role);

    useEffect(() => {
        fetchReports();
    }, [category, selectedDate]);

    const fetchReports = async () => {
        try {
            setLoading(true);
            const res = await api.get('/laporan', {
                params: {
                    category: apiCategory,
                    date: selectedDate
                }
            });
            if (res.data.success) {
                setReports(res.data.reports || []);
                setMyReport(res.data.myReport || null);
                // Separate auto logs (content) and manual points (metadata.manualPoints)
                setAutoContent(res.data.myReport?.content || '');
                const fetchedPoints = res.data.myReport?.metadata?.manualPoints || [];
                setManualPoints(fetchedPoints.length > 0 ? fetchedPoints : ['']);
            }
        } catch (error) {
            console.error('Error fetching reports:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const res = await api.post('/laporan/my', {
                category: apiCategory,
                targetDate: selectedDate,
                manualPoints: manualPoints.filter(p => p.trim() !== '')
            });
            if (res.data.success) {
                alert('Laporan berhasil disimpan!');
                fetchReports();
            }
        } catch (error) {
            console.error('Error saving report:', error);
            alert('Gagal menyimpan laporan.');
        } finally {
            setSaving(false);
        }
    };


    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2 capitalize">
                        <FileText className="text-blue-600" /> Laporan Harian {category}
                    </h1>
                    <p className="text-slate-500 text-sm font-medium">Rekap otomatis kegiatan & input manual</p>
                </div>
                <div className="flex gap-2">
                    <input 
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        onClick={fetchReports}
                        className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all"
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {loading ? (
                 <div className="h-64 flex flex-col items-center justify-center gap-4 bg-white rounded-3xl border border-slate-100 italic text-slate-400">
                    <Loader2 className="animate-spin text-blue-600" size={40} />
                    Memuat data laporan...
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left: Input Laporan Pribadi */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col h-full">
                        <h3 className="text-sm font-black text-slate-800 mb-2 uppercase tracking-wider flex items-center gap-2">
                            <FileText size={18} className="text-blue-600" /> Laporan Saya ({dayjs(selectedDate).format('DD MMM YYYY')})
                        </h3>
                        <p className="text-xs text-slate-500 mb-4">Kegiatan otomatis tercatat di bawah ini. Anda dapat menambahkan catatan manual tambahan.</p>
                        
                        <div className="text-sm font-medium text-slate-600 whitespace-pre-wrap bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-4 empty:hidden">
                            {autoContent}
                        </div>

                        <div className="space-y-3 flex-1 overflow-y-auto pr-2">
                            {manualPoints.map((point, index) => (
                                <div key={index} className="flex gap-2">
                                    <input
                                        className="flex-1 w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                        placeholder={`Kegiatan ke-${index + 1}...`}
                                        value={point}
                                        onChange={(e) => {
                                            const newPoints = [...manualPoints];
                                            newPoints[index] = e.target.value;
                                            setManualPoints(newPoints);
                                        }}
                                    />
                                    <button 
                                        onClick={() => setManualPoints(manualPoints.filter((_, i) => i !== index))}
                                        className="px-3 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all font-bold"
                                    >
                                        &times;
                                    </button>
                                </div>
                            ))}
                            <button
                                onClick={() => setManualPoints([...manualPoints, ''])}
                                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 mt-2 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                            >
                                <Plus size={14} /> Tambah Poin Kegiatan
                            </button>
                        </div>

                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="mt-6 w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50"
                        >
                            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            Simpan Laporan
                        </button>
                    </div>

                    {/* Right: Laporan Tim (Khusus Admin atau untuk melihat laporan rekan) */}
                    {isAdmin && (
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col h-full">
                            <h3 className="text-sm font-black text-slate-800 mb-6 uppercase tracking-wider flex items-center gap-2">
                                <User size={18} className="text-emerald-600" /> Rekap Laporan Tim
                            </h3>
                            <div className="flex-1 overflow-y-auto space-y-4">
                                {reports.length === 0 ? (
                                    <div className="text-center text-slate-400 text-sm py-10 italic">
                                        Belum ada laporan dari tim untuk tanggal ini.
                                    </div>
                                ) : (
                                    reports.map(report => (
                                        <div key={report.id} className="p-4 border border-slate-100 rounded-2xl bg-slate-50">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <div className="font-bold text-slate-800 text-sm">{report.user?.name}</div>
                                                    <div className="text-[10px] text-slate-500 font-bold uppercase">{report.user?.position || report.category}</div>
                                                </div>
                                                <div className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-black">
                                                    {dayjs(report.updatedAt).format('HH:mm')}
                                                </div>
                                            </div>
                                            <div className="text-sm text-slate-600 font-medium">
                                                {report.content && (
                                                    <div className="whitespace-pre-wrap mb-2 text-[11px] text-slate-400 bg-white p-2 rounded-lg border border-slate-100">
                                                        {report.content}
                                                    </div>
                                                )}
                                                {report.metadata?.manualPoints?.length > 0 ? (
                                                    <ul className="list-disc pl-5 space-y-1">
                                                        {report.metadata.manualPoints.map((pt, idx) => (
                                                            <li key={idx}>{pt}</li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    !report.content && <span className="italic text-slate-400 text-[11px]">- Kosong -</span>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default LaporanStaff;
