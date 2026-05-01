import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, Plus, Search, Calendar, User, ArrowRight, Trash2, CheckCircle2, Clock } from 'lucide-react';
import api from '../lib/axios';

const AuditList = () => {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [rooms, setRooms] = useState([]);
    const [selectedRooms, setSelectedRooms] = useState([]);
    const [title, setTitle] = useState('');
    const navigate = useNavigate();

    const fetchSessions = async () => {
        try {
            setLoading(true);
            const res = await api.get('/audit');
            setSessions(res.data);
            const roomRes = await api.get('/master/rooms');
            setRooms(roomRes.data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchSessions(); }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (selectedRooms.length === 0) return alert('Pilih minimal satu ruangan');
        try {
            const res = await api.post('/audit', { title, roomIds: selectedRooms });
            setShowModal(false);
            navigate(`/aset/audit/${res.data.id}`);
        } catch (e) { alert(e.response?.data?.error || 'Gagal membuat sesi audit'); }
    };

    const handleDelete = async (id) => {
        if (!confirm('Hapus sesi audit ini?')) return;
        try {
            await api.delete(`/audit/${id}`);
            fetchSessions();
        } catch (e) { alert('Gagal menghapus'); }
    };

    return (
        <div className="p-4 md:p-8 min-h-screen bg-slate-50 space-y-8">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
                        <div className="p-2 bg-emerald-600 rounded-xl shadow-lg shadow-emerald-100">
                            <ClipboardCheck className="text-white" size={24} />
                        </div>
                        Audit Aset (Stock Opname)
                    </h1>
                    <p className="text-slate-500 font-medium text-sm">Pemeriksaan fisik rutin untuk sinkronisasi data inventaris</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold shadow-xl hover:bg-slate-800 transition-all active:scale-95"
                >
                    <Plus size={20} /> Mulai Audit Baru
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin"></div></div>
            ) : sessions.length === 0 ? (
                <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-20 text-center space-y-4">
                    <p className="text-slate-400 font-medium">Belum ada riwayat audit. Klik "Mulai Audit Baru" untuk memulai.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sessions.map(s => (
                        <div key={s.id} className="bg-white rounded-3xl border border-slate-200 p-6 space-y-5 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                            <div className="flex items-start justify-between">
                                <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${s.status === 'OPEN' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                    {s.status === 'OPEN' ? 'BERJALAN' : 'SELESAI'}
                                </div>
                                <button onClick={() => handleDelete(s.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                            </div>
                            
                            <div className="space-y-1">
                                <h3 className="text-lg font-black text-slate-900 line-clamp-1">{s.title}</h3>
                                <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                                    <Calendar size={14} /> {new Date(s.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </div>
                            </div>

                            <div className="bg-slate-50 rounded-2xl p-4 flex justify-between items-center">
                                <div className="space-y-0.5">
                                    <p className="text-[10px] font-black text-slate-400 uppercase">Total Aset</p>
                                    <p className="text-lg font-black text-slate-800">{s._count.items} Barang</p>
                                </div>
                                <div className="p-2 bg-white rounded-xl shadow-sm">
                                    {s.status === 'OPEN' ? <Clock className="text-amber-500" /> : <CheckCircle2 className="text-emerald-500" />}
                                </div>
                            </div>

                            <div className="flex items-center gap-3 text-xs text-slate-500 pt-2 border-t border-slate-100">
                                <User size={14} /> <span className="font-bold">{s.creator?.name}</span>
                            </div>

                            <button 
                                onClick={() => navigate(`/aset/audit/${s.id}`)}
                                className="w-full flex items-center justify-center gap-2 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 py-3 rounded-xl font-bold transition-all text-sm group"
                            >
                                Lihat Progress <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <form onSubmit={handleCreate} className="bg-white rounded-[32px] w-full max-w-lg p-8 shadow-2xl space-y-6 animate-in zoom-in-95">
                        <div className="space-y-1">
                            <h2 className="text-2xl font-black text-slate-900">Mulai Audit Baru</h2>
                            <p className="text-sm text-slate-500">Tentukan nama sesi dan area yang akan diaudit</p>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Sesi</label>
                                <input
                                    required
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder="Contoh: Audit Semester 1 - Lantai 2"
                                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pilih Ruangan (Scope)</label>
                                <div className="max-h-60 overflow-y-auto border border-slate-100 rounded-2xl p-2 space-y-1 bg-slate-50/50">
                                    {rooms.map(r => (
                                        <label key={r.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 hover:border-emerald-200 cursor-pointer transition-all">
                                            <input
                                                type="checkbox"
                                                checked={selectedRooms.includes(r.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedRooms([...selectedRooms, r.id]);
                                                    else setSelectedRooms(selectedRooms.filter(id => id !== r.id));
                                                }}
                                                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                                            />
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-700">{r.name}</span>
                                                <span className="text-[10px] text-slate-400 font-medium">{r.building} - Lantai {r.floor}</span>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3.5 rounded-2xl font-bold text-slate-400 hover:text-slate-600 transition-colors">Batal</button>
                            <button type="submit" className="flex-1 py-3.5 bg-emerald-600 text-white rounded-2xl font-black shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all">Buat Sesi</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default AuditList;
