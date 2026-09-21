import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    ClipboardCheck, Plus, Search, Calendar, User, ArrowRight, 
    Trash2, CheckCircle2, Clock, AlertCircle, Building2, CheckSquare, Square, X
} from 'lucide-react';
import api from '../lib/axios';

const AuditList = () => {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [sessionToDelete, setSessionToDelete] = useState(null);
    const [rooms, setRooms] = useState([]);
    const [units, setUnits] = useState([]);
    const [selectedUnit, setSelectedUnit] = useState('');
    const [selectedRooms, setSelectedRooms] = useState([]);
    const [title, setTitle] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'OPEN' | 'CLOSED'

    const navigate = useNavigate();

    const fetchSessions = async () => {
        try {
            setLoading(true);
            const res = await api.get('/audit');
            setSessions(res.data);
            const roomRes = await api.get('/master/rooms');
            setRooms(roomRes.data || []);
            const unitRes = await api.get('/master/units');
            setUnits(unitRes.data || []);
        } catch (e) { 
            console.error('Error fetching audit sessions:', e); 
        } finally { 
            setLoading(false); 
        }
    };

    useEffect(() => { 
        fetchSessions(); 
    }, []);

    // Ruangan yang tersedia sesuai unit yang dipilih
    const availableRooms = rooms.filter(r => !selectedUnit || r.unitId === parseInt(selectedUnit));

    const handleSelectAllRooms = () => {
        const roomIds = availableRooms.map(r => r.id);
        setSelectedRooms(roomIds);
    };

    const handleDeselectAllRooms = () => {
        setSelectedRooms([]);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (selectedRooms.length === 0) {
            alert('Pilih minimal satu ruangan untuk diaudit.');
            return;
        }
        try {
            setCreating(true);
            const res = await api.post('/audit', { title, roomIds: selectedRooms });
            setShowModal(false);
            setTitle('');
            setSelectedRooms([]);
            setSelectedUnit('');
            navigate(`/aset/audit/${res.data.id}`);
        } catch (e) { 
            alert(e.response?.data?.error || 'Gagal membuat sesi audit'); 
        } finally {
            setCreating(false);
        }
    };

    const confirmDelete = async () => {
        if (!sessionToDelete) return;
        try {
            await api.delete(`/audit/${sessionToDelete.id}`);
            setSessionToDelete(null);
            fetchSessions();
        } catch (e) { 
            alert(e.response?.data?.error || 'Gagal menghapus sesi audit'); 
        }
    };

    // Filter sessions based on search & status filter
    const filteredSessions = sessions.filter(s => {
        const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
        const matchesSearch = !searchQuery || 
            s.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.creator?.name?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesStatus && matchesSearch;
    });

    const counts = {
        all: sessions.length,
        open: sessions.filter(s => s.status === 'OPEN').length,
        closed: sessions.filter(s => s.status === 'CLOSED').length
    };

    return (
        <div className="p-4 md:p-8 min-h-screen bg-slate-50 space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-600 rounded-2xl shadow-lg shadow-emerald-200">
                            <ClipboardCheck className="text-white" size={26} />
                        </div>
                        Audit Aset (Stock Opname)
                    </h1>
                    <p className="text-slate-500 font-medium text-sm">
                        Pemeriksaan fisik berkala, validasi kondisi, serta rekonsiliasi data inventaris
                    </p>
                </div>
                <button
                    onClick={() => {
                        setTitle('');
                        setSelectedRooms([]);
                        setSelectedUnit('');
                        setShowModal(true);
                    }}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3.5 rounded-2xl font-black shadow-lg shadow-emerald-200 hover:scale-[1.02] active:scale-95 transition-all text-sm"
                >
                    <Plus size={20} /> Mulai Audit Baru
                </button>
            </div>

            {/* Filter Tabs & Search Bar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                {/* Status Tabs */}
                <div className="flex bg-slate-200/70 p-1 rounded-2xl max-w-md">
                    <button
                        onClick={() => setStatusFilter('ALL')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-black transition-all ${
                            statusFilter === 'ALL'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Semua Sesi
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold text-slate-600">
                            {counts.all}
                        </span>
                    </button>
                    <button
                        onClick={() => setStatusFilter('OPEN')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-black transition-all ${
                            statusFilter === 'OPEN'
                                ? 'bg-white text-emerald-700 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Berjalan
                        <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-[10px] font-bold text-emerald-800">
                            {counts.open}
                        </span>
                    </button>
                    <button
                        onClick={() => setStatusFilter('CLOSED')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-black transition-all ${
                            statusFilter === 'CLOSED'
                                ? 'bg-white text-slate-800 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Selesai
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold text-slate-600">
                            {counts.closed}
                        </span>
                    </button>
                </div>

                {/* Search */}
                <div className="relative flex-1 md:max-w-sm">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Cari sesi atau auditor..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all shadow-sm"
                    />
                </div>
            </div>

            {/* Content List */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-24 space-y-3">
                    <div className="w-10 h-10 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin"></div>
                    <p className="text-xs text-slate-400 font-bold">Memuat daftar audit aset...</p>
                </div>
            ) : filteredSessions.length === 0 ? (
                <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-16 text-center space-y-3">
                    <AlertCircle className="mx-auto text-slate-300" size={40} />
                    <h3 className="text-base font-bold text-slate-700">Tidak ada sesi audit yang sesuai</h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        {searchQuery || statusFilter !== 'ALL'
                            ? 'Cobalah ubah kata kunci pencarian atau ganti filter status di atas.'
                            : 'Mulai audit aset perdana untuk mendata dan memverifikasi inventaris di ruangan.'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredSessions.map((s) => {
                        const total = s.stats?.total ?? s._count?.items ?? 0;
                        const found = s.stats?.found ?? 0;
                        const missing = s.stats?.missing ?? 0;
                        const pending = s.stats?.pending ?? (total - found - missing);
                        const progressPct = total > 0 ? Math.round(((found + missing) / total) * 100) : 0;

                        return (
                            <div 
                                key={s.id} 
                                className="bg-white rounded-3xl border border-slate-200 p-6 space-y-5 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
                            >
                                <div className="space-y-4">
                                    {/* Top Status & Delete */}
                                    <div className="flex items-center justify-between">
                                        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                                            s.status === 'OPEN' 
                                                ? 'bg-emerald-100 text-emerald-800' 
                                                : 'bg-slate-100 text-slate-600'
                                        }`}>
                                            <span className={`w-2 h-2 rounded-full ${s.status === 'OPEN' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                                            {s.status === 'OPEN' ? 'BERJALAN' : 'SELESAI'}
                                        </div>
                                        <button 
                                            onClick={() => setSessionToDelete(s)} 
                                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                            title="Hapus sesi audit"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>

                                    {/* Title & Date */}
                                    <div className="space-y-1">
                                        <h3 className="text-lg font-black text-slate-900 line-clamp-2 leading-snug">
                                            {s.title}
                                        </h3>
                                        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                                            <Calendar size={13} /> 
                                            {new Date(s.createdAt).toLocaleDateString('id-ID', { 
                                                day: 'numeric', 
                                                month: 'long', 
                                                year: 'numeric' 
                                            })}
                                        </div>
                                    </div>

                                    {/* Progress Bar & Metric Details */}
                                    <div className="bg-slate-50 rounded-2xl p-4 space-y-3 border border-slate-100">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                                Cakupan Audit
                                            </span>
                                            <span className="font-extrabold text-slate-800">
                                                {found + missing} / {total} Aset ({progressPct}%)
                                            </span>
                                        </div>

                                        {/* Visual Progress Bar */}
                                        <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden flex">
                                            <div 
                                                className="bg-emerald-500 h-full transition-all duration-500" 
                                                style={{ width: `${total > 0 ? (found / total) * 100 : 0}%` }}
                                                title={`Ditemukan: ${found}`}
                                            />
                                            <div 
                                                className="bg-red-500 h-full transition-all duration-500" 
                                                style={{ width: `${total > 0 ? (missing / total) * 100 : 0}%` }}
                                                title={`Hilang: ${missing}`}
                                            />
                                        </div>

                                        {/* Status Breakdown Pills */}
                                        <div className="grid grid-cols-3 gap-2 pt-1">
                                            <div className="text-center p-1.5 bg-white rounded-xl border border-slate-100">
                                                <p className="text-[9px] font-black text-emerald-600 uppercase">Ada</p>
                                                <p className="text-xs font-black text-slate-800">{found}</p>
                                            </div>
                                            <div className="text-center p-1.5 bg-white rounded-xl border border-slate-100">
                                                <p className="text-[9px] font-black text-red-600 uppercase">Hilang</p>
                                                <p className="text-xs font-black text-slate-800">{missing}</p>
                                            </div>
                                            <div className="text-center p-1.5 bg-white rounded-xl border border-slate-100">
                                                <p className="text-[9px] font-black text-slate-400 uppercase">Belum</p>
                                                <p className="text-xs font-black text-slate-800">{pending}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer & Action */}
                                <div className="space-y-3 pt-4 border-t border-slate-100">
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <User size={13} className="text-slate-400" />
                                        <span className="text-[11px] font-medium text-slate-400">Auditor:</span>
                                        <span className="font-bold text-slate-700 truncate">{s.creator?.name || 'Admin'}</span>
                                    </div>

                                    <button 
                                        onClick={() => navigate(`/aset/audit/${s.id}`)}
                                        className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-emerald-600 text-white py-3 rounded-xl font-bold transition-all text-xs group"
                                    >
                                        Buka Lembar Audit 
                                        <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal: Mulai Audit Baru */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
                    <form 
                        onSubmit={handleCreate} 
                        className="bg-white rounded-[32px] w-full max-w-lg p-8 shadow-2xl space-y-6 animate-in zoom-in-95 max-h-[90vh] flex flex-col"
                    >
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <h2 className="text-2xl font-black text-slate-900">Mulai Audit Baru</h2>
                                <p className="text-xs text-slate-500 font-medium">Tentukan nama sesi dan ruangan yang akan diaudit</p>
                            </div>
                            <button 
                                type="button" 
                                onClick={() => setShowModal(false)}
                                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4 overflow-y-auto flex-1 pr-1">
                            {/* Input Nama Sesi */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                    Nama Sesi Audit *
                                </label>
                                <input
                                    required
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder="Contoh: Audit Rutin Semester 1 - Gedung Utama"
                                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all"
                                />
                            </div>

                            {/* Dropdown Unit */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                    Filter Berdasarkan Unit
                                </label>
                                <select
                                    value={selectedUnit}
                                    onChange={e => {
                                        setSelectedUnit(e.target.value);
                                        setSelectedRooms([]);
                                    }}
                                    className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all cursor-pointer"
                                >
                                    <option value="">-- Semua Unit --</option>
                                    {units.map(u => (
                                        <option key={u.id} value={u.id}>{u.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Ruangan Selection */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                        Pilih Ruangan ({selectedRooms.length} dipilih)
                                    </label>
                                    {availableRooms.length > 0 && (
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={handleSelectAllRooms}
                                                className="text-[11px] font-black text-emerald-600 hover:text-emerald-700 hover:underline"
                                            >
                                                Pilih Semua ({availableRooms.length})
                                            </button>
                                            <span className="text-slate-300">|</span>
                                            <button
                                                type="button"
                                                onClick={handleDeselectAllRooms}
                                                className="text-[11px] font-bold text-slate-400 hover:text-slate-600"
                                            >
                                                Reset
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="max-h-56 overflow-y-auto border border-slate-100 rounded-2xl p-2 space-y-1.5 bg-slate-50/70">
                                    {availableRooms.length === 0 ? (
                                        <p className="text-xs text-slate-400 text-center py-6">
                                            Tidak ada ruangan di unit ini
                                        </p>
                                    ) : (
                                        availableRooms.map(r => {
                                            const isSelected = selectedRooms.includes(r.id);
                                            return (
                                                <label 
                                                    key={r.id} 
                                                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                                        isSelected 
                                                            ? 'bg-emerald-50/70 border-emerald-300' 
                                                            : 'bg-white border-slate-100 hover:border-slate-200'
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={(e) => {
                                                            if (e.target.checked) setSelectedRooms([...selectedRooms, r.id]);
                                                            else setSelectedRooms(selectedRooms.filter(id => id !== r.id));
                                                        }}
                                                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                                    />
                                                    <div className="flex flex-col flex-1 min-w-0">
                                                        <span className="text-xs font-bold text-slate-800 truncate">
                                                            {r.name}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-medium">
                                                            {r.building || 'Gedung Utama'} {r.floor ? `• Lt. ${r.floor}` : ''}
                                                        </span>
                                                    </div>
                                                </label>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2 border-t border-slate-100">
                            <button 
                                type="button" 
                                onClick={() => setShowModal(false)} 
                                className="flex-1 py-3.5 rounded-2xl font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all text-xs"
                            >
                                Batal
                            </button>
                            <button 
                                type="submit" 
                                disabled={creating || selectedRooms.length === 0}
                                className="flex-1 py-3.5 bg-emerald-600 text-white rounded-2xl font-black shadow-lg shadow-emerald-200 hover:bg-emerald-700 disabled:opacity-50 transition-all text-xs flex items-center justify-center gap-2"
                            >
                                {creating ? 'Memproses...' : 'Buat Sesi & Mulai'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Modal: Konfirmasi Hapus */}
            {sessionToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4 animate-in zoom-in-95 text-center">
                        <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto">
                            <Trash2 size={24} />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-base font-black text-slate-800">Hapus Sesi Audit?</h3>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                Sesi <span className="font-bold text-slate-700">"{sessionToDelete.title}"</span> dan seluruh rekaman pemeriksaan fisik di dalamnya akan dihapus.
                            </p>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => setSessionToDelete(null)}
                                className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-50 text-xs transition-colors"
                            >
                                Batal
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-xs shadow-lg shadow-red-200 transition-all"
                            >
                                Ya, Hapus
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AuditList;

