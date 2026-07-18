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
    const [manualContent, setManualContent] = useState('');
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
                // Extract only manual part if needed, or just let them edit the whole block.
                // For simplicity, we just allow them to append to the report or we can just keep the whole content editable.
                // We'll keep the whole content editable so they see automatic logs and can type below.
                setManualContent(res.data.myReport?.content || '');
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
                content: manualContent
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

    const isToday = selectedDate === dayjs().format('YYYY-MM-DD');

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
                        
                        <textarea
                            className="flex-1 w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-700 min-h-[250px] focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            placeholder="Ketik laporan manual Anda di sini..."
                            value={manualContent}
                            onChange={(e) => setManualContent(e.target.value)}
                            readOnly={!isToday}
                        ></textarea>

                        {isToday && (
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="mt-4 flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50"
                            >
                                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                Simpan Laporan
                            </button>
                        )}
                        {!isToday && (
                            <div className="mt-4 text-xs font-bold text-amber-500 bg-amber-50 p-3 rounded-xl border border-amber-100">
                                Laporan hari sebelumnya tidak dapat diubah.
                            </div>
                        )}
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
                                            <div className="text-sm text-slate-600 whitespace-pre-wrap font-medium">
                                                {report.content || '- Kosong -'}
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
