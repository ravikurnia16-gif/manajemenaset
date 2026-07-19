import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { FileText, Calendar, Plus, Save, RefreshCw, Loader2, User, Camera, X, MapPin } from 'lucide-react';
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
    const [manualPoints, setManualPoints] = useState([{ text: '', photo: null, location: null }]);
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
                const formattedPoints = fetchedPoints.length > 0 
                    ? fetchedPoints.map(p => typeof p === 'string' ? { text: p, photo: null, location: null } : p)
                    : [{ text: '', photo: null, location: null }];
                setManualPoints(formattedPoints);
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
                manualPoints: manualPoints.filter(p => (p.text && p.text.trim() !== '') || p.photo)
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

    const handlePhotoUpload = (index, file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const newPoints = [...manualPoints];
            newPoints[index].photo = e.target.result;
            
            // Try to capture geolocation
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition((pos) => {
                    const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    const npWithLoc = [...newPoints];
                    npWithLoc[index].location = loc;
                    setManualPoints(npWithLoc);
                }, (err) => {
                    console.warn("Geolocation failed", err);
                    setManualPoints([...newPoints]);
                }, { enableHighAccuracy: true, timeout: 10000 });
            } else {
                setManualPoints([...newPoints]);
            }
        };
        reader.readAsDataURL(file);
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

                        <div className="space-y-4 flex-1 overflow-y-auto pr-2">
                            {manualPoints.map((point, index) => (
                                <div key={index} className="flex flex-col gap-2 p-3 bg-white border border-slate-200 rounded-2xl shadow-sm relative group">
                                    <div className="flex gap-2">
                                        <input
                                            className="flex-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                            placeholder={`Kegiatan ke-${index + 1}...`}
                                            value={point.text}
                                            onChange={(e) => {
                                                const newPoints = [...manualPoints];
                                                newPoints[index].text = e.target.value;
                                                setManualPoints(newPoints);
                                            }}
                                        />
                                        <label className="p-2 cursor-pointer text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all border border-slate-200 bg-slate-50" title="Lampirkan Foto">
                                            <Camera size={18} />
                                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(index, e.target.files[0])} />
                                        </label>
                                        <button 
                                            onClick={() => setManualPoints(manualPoints.filter((_, i) => i !== index))}
                                            className="px-3 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all font-bold border border-transparent hover:border-rose-200"
                                            title="Hapus Poin"
                                        >
                                            &times;
                                        </button>
                                    </div>
                                    {point.photo && (
                                        <div className="flex gap-4 items-end bg-slate-50 p-2 rounded-xl border border-slate-100">
                                            <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-slate-200 group/photo shrink-0">
                                                <img src={point.photo} alt="Lampiran" className="w-full h-full object-cover" />
                                                <button 
                                                    onClick={() => { const np = [...manualPoints]; np[index].photo = null; np[index].location = null; setManualPoints(np); }} 
                                                    className="absolute top-1 right-1 bg-white/90 p-1 rounded-full text-rose-500 opacity-0 group-hover/photo:opacity-100 transition-opacity shadow-sm"
                                                    title="Hapus Foto"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                            {point.location && (
                                                <div className="text-[10px] font-bold text-slate-500 flex items-center gap-1 bg-white px-2 py-1.5 rounded-lg border border-slate-200 shadow-sm mb-1">
                                                    <MapPin size={12} className="text-emerald-500" />
                                                    {point.location.lat.toFixed(6)}, {point.location.lng.toFixed(6)}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                            <button
                                onClick={() => setManualPoints([...manualPoints, { text: '', photo: null, location: null }])}
                                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 mt-2 px-3 py-2 rounded-xl hover:bg-blue-50 transition-colors border border-dashed border-blue-200 w-full justify-center"
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
                                                    <ul className="list-none space-y-3 mt-2">
                                                        {report.metadata.manualPoints.map((pt, idx) => {
                                                            const text = typeof pt === 'string' ? pt : pt.text;
                                                            const photo = typeof pt === 'string' ? null : pt.photo;
                                                            const loc = typeof pt === 'string' ? null : pt.location;
                                                            return (
                                                                <li key={idx} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                                                    <div className="flex gap-2 items-start">
                                                                        <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</div>
                                                                        <div className="flex-1">
                                                                            <p className="text-sm text-slate-700">{text}</p>
                                                                            {photo && (
                                                                                <div className="mt-2 flex gap-4 items-start">
                                                                                    <a href={photo} target="_blank" rel="noreferrer" className="block w-32 h-32 rounded-lg overflow-hidden border border-slate-200 hover:opacity-80 transition-opacity">
                                                                                        <img src={photo} alt={`Lampiran ${idx + 1}`} className="w-full h-full object-cover" />
                                                                                    </a>
                                                                                    {loc && (
                                                                                        <a 
                                                                                            href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`}
                                                                                            target="_blank"
                                                                                            rel="noreferrer"
                                                                                            className="text-[10px] font-bold text-blue-600 flex items-center gap-1 bg-blue-50 hover:bg-blue-100 px-2 py-1.5 rounded-lg border border-blue-200 shadow-sm transition-colors mt-1"
                                                                                            title="Buka di Google Maps"
                                                                                        >
                                                                                            <MapPin size={12} className="text-blue-500" />
                                                                                            Buka Peta Lokasi
                                                                                        </a>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </li>
                                                            );
                                                        })}
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
