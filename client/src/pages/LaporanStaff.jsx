import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { FileText, Calendar, Plus, Save, RefreshCw, Loader2, User, Camera, X, Clock, CheckCircle } from 'lucide-react';
import api from '../lib/axios';
import dayjs from 'dayjs';

const LaporanStaff = () => {
    const { category } = useParams(); // e.g. 'gudang', 'aset', 'teknisi', 'kendaraan', 'keuangan'
    
    // Map URL param to API category
    const categoryMap = {
        'gudang': 'GUDANG',
        'aset': 'ASET',
        'teknisi': 'TEKNISI',
        'kendaraan': 'KENDARAAN',
        'keuangan': 'KEUANGAN'
    };
    
    const apiCategory = categoryMap[category] || 'UMUM';

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [reports, setReports] = useState([]);
    const [myReport, setMyReport] = useState(null);
    const [autoContent, setAutoContent] = useState('');
    const [morningPoints, setMorningPoints] = useState([{ text: '', photos: [] }]);
    const [afternoonPoints, setAfternoonPoints] = useState([{ text: '', photos: [] }]);
    const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
    const [activeTab, setActiveTab] = useState('laporan');

    const [assignments, setAssignments] = useState([]);
    const [staffList, setStaffList] = useState([]);
    const [showAssignmentForm, setShowAssignmentForm] = useState(false);
    const [assignmentForm, setAssignmentForm] = useState({ title: '', description: '', assigneeId: '', dueDate: '' });

    const user = JSON.parse(localStorage.getItem('user')) || {};
    const isAdmin = ['SUPER_ADMIN', 'BIDANG_IT', 'KABID_SARPRAS'].includes(user.role);
    const isKabidSarpras = user.role === 'KABID_SARPRAS' || (user.position && user.position.toLowerCase().includes('kepala bidang') && user.position.toLowerCase().includes('sarana'));

    useEffect(() => {
        if (activeTab === 'laporan') fetchReports();
        if (activeTab === 'penugasan') {
            fetchAssignments();
            if (isKabidSarpras) fetchStaffList();
        }
    }, [category, selectedDate, activeTab]);

    const fetchAssignments = async () => {
        try {
            setLoading(true);
            const res = await api.get('/personnel/assignments', {
                params: { category: apiCategory }
            });
            if (res.data.success) {
                setAssignments(res.data.assignments || []);
            }
        } catch (error) {
            console.error('Error fetching assignments:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchStaffList = async () => {
        try {
            const res = await api.get('/personnel/staff');
            if (res.data.success) {
                setStaffList(res.data.staff || []);
            }
        } catch (error) {
            console.error('Error fetching staff:', error);
        }
    };

    const handleCreateAssignment = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);
            const res = await api.post('/personnel/assignments', {
                ...assignmentForm,
                category: apiCategory
            });
            if (res.data.success) {
                alert('Penugasan berhasil dibuat!');
                setShowAssignmentForm(false);
                setAssignmentForm({ title: '', description: '', assigneeId: '', dueDate: '' });
                fetchAssignments();
            }
        } catch (error) {
            console.error('Error creating assignment:', error);
            alert('Gagal membuat penugasan.');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateProgress = async (id, val) => {
        try {
            await api.put(`/personnel/assignments/${id}/status`, { progressPercentage: parseInt(val) });
            fetchAssignments();
        } catch (error) {
            alert('Gagal update progress');
        }
    };

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
                setAutoContent(res.data.globalSummary || res.data.myReport?.content || '');
                const fetchedPoints = res.data.myReport?.metadata?.manualPoints || [];
                
                const formatPoints = (pts) => pts.map(p => {
                    if (typeof p === 'string') return { text: p, photos: [] };
                    const newP = { text: p.text || '', photos: p.photos || [] };
                    if (p.photo) newP.photos = [{ url: p.photo, timestamp: p.timestamp }, ...newP.photos];
                    return newP;
                });

                if (Array.isArray(fetchedPoints)) {
                    const formattedPoints = fetchedPoints.length > 0 ? formatPoints(fetchedPoints) : [{ text: '', photos: [] }];
                    setMorningPoints(formattedPoints);
                    setAfternoonPoints([{ text: '', photos: [] }]);
                } else {
                    const m = fetchedPoints.morning || [];
                    const a = fetchedPoints.afternoon || [];
                    setMorningPoints(m.length > 0 ? formatPoints(m) : [{ text: '', photos: [] }]);
                    setAfternoonPoints(a.length > 0 ? formatPoints(a) : [{ text: '', photos: [] }]);
                }
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
                manualPoints: {
                    morning: morningPoints.filter(p => (p.text && p.text.trim() !== '') || p.photos.length > 0),
                    afternoon: afternoonPoints.filter(p => (p.text && p.text.trim() !== '') || p.photos.length > 0)
                }
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

    const handlePhotoUpload = (index, file, period = 'morning') => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            if (period === 'morning') {
                const newPoints = [...morningPoints];
                if (newPoints[index].photos.length >= 5) return alert('Maksimal 5 foto per kegiatan!');
                newPoints[index].photos.push({ url: e.target.result, timestamp: new Date().toISOString() });
                setMorningPoints(newPoints);
            } else {
                const newPoints = [...afternoonPoints];
                if (newPoints[index].photos.length >= 5) return alert('Maksimal 5 foto per kegiatan!');
                newPoints[index].photos.push({ url: e.target.result, timestamp: new Date().toISOString() });
                setAfternoonPoints(newPoints);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleRemovePhoto = (pointIndex, photoIndex, period = 'morning') => {
        if (period === 'morning') {
            const newPoints = [...morningPoints];
            newPoints[pointIndex].photos = newPoints[pointIndex].photos.filter((_, i) => i !== photoIndex);
            setMorningPoints(newPoints);
        } else {
            const newPoints = [...afternoonPoints];
            newPoints[pointIndex].photos = newPoints[pointIndex].photos.filter((_, i) => i !== photoIndex);
            setAfternoonPoints(newPoints);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2 capitalize">
                        <FileText className="text-blue-600" /> Laporan Harian {category}
                    </h1>
                    <p className="text-slate-500 text-sm font-medium">Catat kegiatan harian Anda</p>
                </div>
                <div className="flex gap-2">
                    {activeTab === 'laporan' && (
                        <input 
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500"
                        />
                    )}
                    <button
                        onClick={activeTab === 'laporan' ? fetchReports : fetchAssignments}
                        className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all"
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            <div className="flex gap-6 border-b border-slate-200 mb-2">
                <button 
                    className={`pb-3 text-sm font-black border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'laporan' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    onClick={() => setActiveTab('laporan')}
                >
                    <FileText size={18} /> Laporan Harian
                </button>
                <button 
                    className={`pb-3 text-sm font-black border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'penugasan' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    onClick={() => setActiveTab('penugasan')}
                >
                    <Calendar size={18} /> Penugasan
                </button>
            </div>

            {loading ? (
                 <div className="h-64 flex flex-col items-center justify-center gap-4 bg-white rounded-3xl border border-slate-100 italic text-slate-400">
                    <Loader2 className="animate-spin text-blue-600" size={40} />
                    Memuat data...
                </div>
            ) : (
                <>
                {activeTab === 'laporan' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left: Input Laporan Pribadi */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col h-full">
                        <h3 className="text-sm font-black text-slate-800 mb-4 uppercase tracking-wider flex items-center gap-2">
                            <FileText size={18} className="text-blue-600" /> Laporan Saya ({dayjs(selectedDate).format('DD MMM YYYY')})
                        </h3>

                        <div className="space-y-6 flex-1 overflow-y-auto pr-2">
                            {/* Sesi Pagi */}
                            <div>
                                <h4 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider border-b border-slate-100 pb-2">Kegiatan Pagi (07.30 - 12.00)</h4>
                                <div className="space-y-4">
                                    {morningPoints.map((point, index) => (
                                        <div key={`m-${index}`} className="flex flex-col gap-2 p-3 bg-white border border-slate-200 rounded-2xl shadow-sm relative group">
                                            <div className="flex gap-2">
                                                <input
                                                    className="flex-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                                    placeholder={`Kegiatan Pagi ke-${index + 1}...`}
                                                    value={point.text}
                                                    onChange={(e) => {
                                                        const newPoints = [...morningPoints];
                                                        newPoints[index].text = e.target.value;
                                                        setMorningPoints(newPoints);
                                                    }}
                                                />
                                                <label className="p-2 cursor-pointer text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all border border-slate-200 bg-slate-50" title="Lampirkan Foto">
                                                    <Camera size={18} />
                                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(index, e.target.files[0], 'morning')} />
                                                </label>
                                                <button 
                                                    onClick={() => setMorningPoints(morningPoints.filter((_, i) => i !== index))}
                                                    className="px-3 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all font-bold border border-transparent hover:border-rose-200"
                                                    title="Hapus Poin"
                                                >
                                                    &times;
                                                </button>
                                            </div>
                                            {point.photos && point.photos.length > 0 && (
                                                <div className="flex flex-wrap gap-4 items-end bg-slate-50 p-2 rounded-xl border border-slate-100">
                                                    {point.photos.map((photoObj, photoIndex) => (
                                                        <div key={photoIndex} className="relative w-32 h-32 rounded-xl overflow-hidden border border-slate-200 group/photo shrink-0">
                                                            <img src={photoObj.url} alt={`Lampiran Pagi ${photoIndex + 1}`} className="w-full h-full object-cover" />
                                                            <button 
                                                                onClick={() => handleRemovePhoto(index, photoIndex, 'morning')} 
                                                                className="absolute top-1 right-1 bg-white/90 p-1 rounded-full text-rose-500 opacity-0 group-hover/photo:opacity-100 transition-opacity shadow-sm"
                                                                title="Hapus Foto"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                            {photoObj.timestamp && (
                                                                <div className="absolute bottom-1 left-1 right-1 bg-white/90 text-[9px] font-bold text-slate-600 flex items-center justify-center gap-1 px-1 py-1 rounded shadow-sm opacity-90 truncate">
                                                                    <Clock size={10} className="text-blue-500" />
                                                                    {dayjs(photoObj.timestamp).format('HH:mm')}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => setMorningPoints([...morningPoints, { text: '', photo: null, timestamp: null }])}
                                        className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 mt-2 px-3 py-2 rounded-xl hover:bg-blue-50 transition-colors border border-dashed border-blue-200 w-full justify-center"
                                    >
                                        <Plus size={14} /> Tambah Kegiatan Pagi
                                    </button>
                                </div>
                            </div>

                            {/* Sesi Siang */}
                            <div>
                                <h4 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider border-b border-slate-100 pb-2">Kegiatan Siang (13.00 - 16.15)</h4>
                                <div className="space-y-4">
                                    {afternoonPoints.map((point, index) => (
                                        <div key={`a-${index}`} className="flex flex-col gap-2 p-3 bg-white border border-slate-200 rounded-2xl shadow-sm relative group">
                                            <div className="flex gap-2">
                                                <input
                                                    className="flex-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                                    placeholder={`Kegiatan Siang ke-${index + 1}...`}
                                                    value={point.text}
                                                    onChange={(e) => {
                                                        const newPoints = [...afternoonPoints];
                                                        newPoints[index].text = e.target.value;
                                                        setAfternoonPoints(newPoints);
                                                    }}
                                                />
                                                <label className="p-2 cursor-pointer text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all border border-slate-200 bg-slate-50" title="Lampirkan Foto">
                                                    <Camera size={18} />
                                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(index, e.target.files[0], 'afternoon')} />
                                                </label>
                                                <button 
                                                    onClick={() => setAfternoonPoints(afternoonPoints.filter((_, i) => i !== index))}
                                                    className="px-3 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all font-bold border border-transparent hover:border-rose-200"
                                                    title="Hapus Poin"
                                                >
                                                    &times;
                                                </button>
                                            </div>
                                            {point.photos && point.photos.length > 0 && (
                                                <div className="flex flex-wrap gap-4 items-end bg-slate-50 p-2 rounded-xl border border-slate-100">
                                                    {point.photos.map((photoObj, photoIndex) => (
                                                        <div key={photoIndex} className="relative w-32 h-32 rounded-xl overflow-hidden border border-slate-200 group/photo shrink-0">
                                                            <img src={photoObj.url} alt={`Lampiran Siang ${photoIndex + 1}`} className="w-full h-full object-cover" />
                                                            <button 
                                                                onClick={() => handleRemovePhoto(index, photoIndex, 'afternoon')} 
                                                                className="absolute top-1 right-1 bg-white/90 p-1 rounded-full text-rose-500 opacity-0 group-hover/photo:opacity-100 transition-opacity shadow-sm"
                                                                title="Hapus Foto"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                            {photoObj.timestamp && (
                                                                <div className="absolute bottom-1 left-1 right-1 bg-white/90 text-[9px] font-bold text-slate-600 flex items-center justify-center gap-1 px-1 py-1 rounded shadow-sm opacity-90 truncate">
                                                                    <Clock size={10} className="text-blue-500" />
                                                                    {dayjs(photoObj.timestamp).format('HH:mm')}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => setAfternoonPoints([...afternoonPoints, { text: '', photo: null, timestamp: null }])}
                                        className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 mt-2 px-3 py-2 rounded-xl hover:bg-blue-50 transition-colors border border-dashed border-blue-200 w-full justify-center"
                                    >
                                        <Plus size={14} /> Tambah Kegiatan Siang
                                    </button>
                                </div>
                            </div>
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
                                                {(() => {
                                                    const pts = report.metadata?.manualPoints;
                                                    if (!pts) return <span className="italic text-slate-400 text-[11px]">- Kosong -</span>;
                                                    
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

                                                    if (Array.isArray(pts)) {
                                                        return pts.length > 0 ? renderList(null, pts) : <span className="italic text-slate-400 text-[11px]">- Kosong -</span>;
                                                    } else {
                                                        const m = pts.morning || [];
                                                        const a = pts.afternoon || [];
                                                        if (m.length === 0 && a.length === 0) return <span className="italic text-slate-400 text-[11px]">- Kosong -</span>;
                                                        return (
                                                            <>
                                                                {renderList('Kegiatan Pagi (07.30 - 12.00)', m)}
                                                                {renderList('Kegiatan Siang (13.00 - 16.15)', a)}
                                                            </>
                                                        );
                                                    }
                                                })()}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
                )}

                {activeTab === 'penugasan' && (
                    <div className="space-y-6">
                        {isKabidSarpras && (
                            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2">
                                        <Calendar size={18} className="text-blue-600" /> Manajemen Penugasan
                                    </h3>
                                    <button 
                                        onClick={() => setShowAssignmentForm(!showAssignmentForm)}
                                        className="text-xs font-bold bg-blue-50 text-blue-600 px-4 py-2 rounded-xl hover:bg-blue-100 transition-colors"
                                    >
                                        {showAssignmentForm ? 'Batal' : '+ Buat Penugasan Baru'}
                                    </button>
                                </div>

                                {showAssignmentForm && (
                                    <form onSubmit={handleCreateAssignment} className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 mb-1">Judul Penugasan</label>
                                                <input required value={assignmentForm.title} onChange={e => setAssignmentForm({...assignmentForm, title: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500" placeholder="Misal: Perbaikan AC Gudang" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 mb-1">Ditugaskan Kepada (Staf)</label>
                                                <select required value={assignmentForm.assigneeId} onChange={e => setAssignmentForm({...assignmentForm, assigneeId: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500">
                                                    <option value="">Pilih Staf</option>
                                                    {staffList.map(s => (
                                                        <option key={s.id} value={s.id}>{s.name || s.username} ({s.position || 'Staf'})</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-xs font-bold text-slate-500 mb-1">Deskripsi Tugas</label>
                                                <textarea required value={assignmentForm.description} onChange={e => setAssignmentForm({...assignmentForm, description: e.target.value})} rows="3" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500" placeholder="Rincian penugasan..."></textarea>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 mb-1">Deadline / Batas Waktu</label>
                                                <input required type="date" value={assignmentForm.dueDate} onChange={e => setAssignmentForm({...assignmentForm, dueDate: e.target.value})} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500" />
                                            </div>
                                        </div>
                                        <button disabled={saving} type="submit" className="w-full bg-blue-600 text-white font-bold text-sm px-4 py-3 rounded-xl hover:bg-blue-700 transition-colors">
                                            {saving ? 'Menyimpan...' : 'Kirim Penugasan'}
                                        </button>
                                    </form>
                                )}
                            </div>
                        )}

                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                            <h3 className="text-sm font-black text-slate-800 mb-4 uppercase tracking-wider flex items-center gap-2">
                                <FileText size={18} className="text-blue-600" /> Daftar Penugasan {category}
                            </h3>
                            {assignments.length === 0 ? (
                                <div className="text-center text-slate-400 text-sm py-10 italic border border-dashed border-slate-200 rounded-2xl">
                                    Belum ada penugasan untuk kategori ini.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {assignments.map(task => (
                                        <div key={task.id} className="p-4 border border-slate-200 rounded-2xl bg-white shadow-sm flex flex-col gap-3 relative overflow-hidden group">
                                            {task.progressPercentage === 100 && (
                                                <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-black px-3 py-1 rounded-bl-xl shadow-sm">SELESAI</div>
                                            )}
                                            <div>
                                                <div className="text-xs font-bold text-blue-600 mb-1">{task.category}</div>
                                                <div className="font-bold text-slate-800 text-sm">{task.title}</div>
                                                <div className="text-xs text-slate-500 mt-1">{task.description}</div>
                                            </div>
                                            
                                            <div className="flex items-center gap-4 text-xs font-bold text-slate-600 bg-slate-50 p-2 rounded-xl">
                                                <div className="flex items-center gap-1">
                                                    <User size={14} className="text-slate-400" /> 
                                                    {task.assignee?.name || task.assignee?.username}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Clock size={14} className={dayjs(task.dueDate).isBefore(dayjs()) && task.progressPercentage < 100 ? 'text-rose-500' : 'text-slate-400'} />
                                                    <span className={dayjs(task.dueDate).isBefore(dayjs()) && task.progressPercentage < 100 ? 'text-rose-600' : ''}>
                                                        {dayjs(task.dueDate).format('DD MMM YYYY')}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="mt-2">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Progress Kerja</span>
                                                    <span className="text-xs font-black text-blue-600">{task.progressPercentage}%</span>
                                                </div>
                                                {/* Only assignee can update their progress, or Admin/Kabid can override */}
                                                {(user.id === task.assigneeId || isKabidSarpras) ? (
                                                    <input 
                                                        type="range" 
                                                        min="0" max="100" step="10"
                                                        value={task.progressPercentage} 
                                                        onChange={(e) => handleUpdateProgress(task.id, e.target.value)}
                                                        className="w-full accent-blue-600 cursor-pointer"
                                                    />
                                                ) : (
                                                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                                        <div className="bg-blue-600 h-full" style={{ width: `${task.progressPercentage}%` }}></div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
                </>
            )}
        </div>
    );
};

export default LaporanStaff;
