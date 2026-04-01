import { useState, useEffect } from 'react';
import { 
    Calendar, Clock, Plus, Search, User, MapPin, Tag, 
    MoreVertical, Trash2, Edit2, CheckCircle2, AlertCircle, 
    X, ChevronDown, ChevronUp, Zap, ListChecks, ArrowRight 
} from 'lucide-react';
import api from '../lib/axios';

const FrequencyBadge = ({ frequency, config }) => {
    const labels = {
        DAILY: { label: 'HARIAN', color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
        WEEKLY: { label: 'MINGGUAN', color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
        MONTHLY: { label: 'BULANAN', color: 'bg-amber-50 text-amber-600 border-amber-100' }
    };

    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    let detail = '';
    if (frequency === 'WEEKLY' && config.dayOfWeek !== null) detail = ` (${days[config.dayOfWeek]})`;
    if (frequency === 'MONTHLY' && config.dayOfMonth !== null) detail = ` (Tgl ${config.dayOfMonth})`;

    return (
        <div className={`px-3 py-1 rounded-full border text-[9px] font-black tracking-widest shadow-sm ${labels[frequency]?.color}`}>
            {labels[frequency]?.label}{detail}
        </div>
    );
};

const PersonnelRoutine = () => {
    const [routines, setRoutines] = useState([]);
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingRoutine, setEditingRoutine] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        assigneeId: '',
        category: 'UMUM',
        priority: 'MEDIUM',
        location: '',
        frequency: 'DAILY',
        dayOfWeek: 1, // Monday
        dayOfMonth: 1,
        items: []
    });

    const [newItemText, setNewItemText] = useState('');

    useEffect(() => {
        fetchRoutines();
        fetchStaff();
    }, []);

    const fetchRoutines = async () => {
        try {
            const res = await api.get('/personnel/routines');
            setRoutines(res.data);
        } catch (err) {
            console.error('Failed to fetch routines:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchStaff = async () => {
        try {
            const res = await api.get('/personnel/staff');
            setStaff(res.data);
        } catch (err) {
            console.error('Failed to fetch staff:', err);
        }
    };

    const handleAddItem = () => {
        if (!newItemText.trim()) return;
        setFormData({
            ...formData,
            items: [...formData.items, { text: newItemText.trim(), status: 'PENDING' }]
        });
        setNewItemText('');
    };

    const handleRemoveItem = (index) => {
        const newItems = [...formData.items];
        newItems.splice(index, 1);
        setFormData({ ...formData, items: newItems });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingRoutine) {
                await api.put(`/personnel/routines/${editingRoutine.id}`, formData);
            } else {
                await api.post('/personnel/routines', formData);
            }
            setShowModal(false);
            fetchRoutines();
            resetForm();
        } catch (err) {
            alert('Gagal menyimpan jadwal rutin: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Yakin ingin menghapus jadwal rutin ini?')) return;
        try {
            await api.delete(`/personnel/routines/${id}`);
            fetchRoutines();
        } catch (err) {
            alert('Gagal menghapus: ' + err.message);
        }
    };

    const resetForm = () => {
        setFormData({
            title: '',
            description: '',
            assigneeId: '',
            category: 'UMUM',
            priority: 'MEDIUM',
            location: '',
            frequency: 'DAILY',
            dayOfWeek: 1,
            dayOfMonth: 1,
            items: []
        });
        setEditingRoutine(null);
    };

    const openEdit = (r) => {
        setEditingRoutine(r);
        setFormData({
            title: r.title,
            description: r.description,
            assigneeId: r.assigneeId,
            category: r.category,
            priority: r.priority,
            location: r.location || '',
            frequency: r.frequency,
            dayOfWeek: r.dayOfWeek || 1,
            dayOfMonth: r.dayOfMonth || 1,
            items: r.items || [],
            isActive: r.isActive
        });
        setShowModal(true);
    };

    const filteredRoutines = routines.filter(r => 
        r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.assignee?.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-4 md:p-8 bg-[#F8FAFC] min-h-screen pt-20 pb-24">
            {/* Header Section */}
            <div className="max-w-7xl mx-auto space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-100 flex items-center justify-center">
                                <Zap className="text-white" size={24} />
                            </div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight italic uppercase">
                                SISTEM <span className="text-indigo-600"> RUTINITAS</span>
                            </h1>
                        </div>
                        <p className="text-sm font-medium text-slate-400 pl-14">
                            Otomatisasi Tugas Terjadwal & Perawatan Aset Melalui Penugasan Rutin.
                        </p>
                    </div>

                    <button 
                        onClick={() => { resetForm(); setShowModal(true); }}
                        className="flex items-center justify-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs tracking-widest shadow-2xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95 group"
                    >
                        <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" />
                        BUAT JADWAL BARU
                    </button>
                </div>

                {/* Filters & Grid */}
                <div className="relative group">
                    <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                        <Search size={18} strokeWidth={3} />
                    </div>
                    <input 
                        type="text" 
                        placeholder="Cari berdasarkan judul atau nama ustadz..." 
                        className="w-full bg-white border-0 py-5 pl-14 pr-6 rounded-3xl text-sm font-bold text-slate-700 shadow-xl shadow-slate-100/50 focus:ring-2 focus:ring-indigo-500/10 placeholder:text-slate-300 transition-all outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Card List */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading ? (
                        <div className="col-span-full py-20 flex flex-col items-center gap-4">
                            <Zap className="animate-pulse text-indigo-200" size={48} />
                            <p className="text-[10px] font-black tracking-widest text-slate-300 uppercase">Mengunggah Data...</p>
                        </div>
                    ) : filteredRoutines.length === 0 ? (
                        <div className="col-span-full py-20 bg-white rounded-[40px] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center gap-4 grayscale opacity-40">
                            <Zap size={48} />
                            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Belum ada jadwal rutin</p>
                        </div>
                    ) : (
                        filteredRoutines.map((r) => (
                            <div key={r.id} className="bg-white rounded-[32px] p-6 shadow-xl shadow-slate-100/40 border border-slate-50 transition-all hover:scale-[1.02] hover:shadow-2xl hover:shadow-slate-200 group relative overflow-hidden">
                                <div className={`absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full blur-3xl opacity-10 transition-colors ${r.isActive ? 'bg-indigo-600' : 'bg-slate-400'}`} />
                                
                                <div className="flex justify-between items-start mb-6">
                                    <FrequencyBadge frequency={r.frequency} config={{ dayOfWeek: r.dayOfWeek, dayOfMonth: r.dayOfMonth }} />
                                    <div className="flex gap-2">
                                        <button onClick={() => openEdit(r)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                                            <Edit2 size={16} />
                                        </button>
                                        <button onClick={() => handleDelete(r.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-4 mb-8">
                                    <div>
                                        <h3 className="text-lg font-black text-slate-900 leading-tight group-hover:text-indigo-600 transition-colors uppercase italic tracking-tight">{r.title}</h3>
                                        <p className="text-xs font-bold text-slate-400 mt-1 line-clamp-2 leading-relaxed">{r.description || 'Tidak ada deskripsi.'}</p>
                                    </div>

                                    <div className="bg-slate-50/50 rounded-2xl p-4 space-y-3">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-100">
                                                <User size={14} className="text-slate-400" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[8px] font-black text-slate-300 uppercase tracking-tighter">DIKERJAKAN OLEH</span>
                                                <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">{r.assignee?.name}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${r.isActive ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-300'}`} />
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{r.isActive ? 'AKTIF' : 'NONAKTIF'}</span>
                                    </div>
                                    {r.lastGenerated && (
                                        <div className="text-right">
                                            <p className="text-[8px] font-black text-slate-300 uppercase">TERAKHIR TERBIT</p>
                                            <p className="text-[10px] font-black text-slate-600 italic uppercase">{new Date(r.lastGenerated).toLocaleDateString('id-ID')}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Modal Form */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setShowModal(false)} />
                    <div className="bg-white rounded-[40px] w-full max-w-2xl max-h-[90vh] overflow-hidden relative shadow-2xl animate-in zoom-in slide-in-from-bottom-10 duration-300">
                        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 uppercase italic tracking-tight">
                                    {editingRoutine ? 'EDIT' : 'BUAT'} <span className="text-indigo-600 tracking-widest"> JADWAL RUTIN</span>
                                </h2>
                                <p className="text-[10px] font-black text-slate-400 tracking-widest">ATUR OTOMATISASI PENUGASAN PERSONEL</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-3 hover:bg-white rounded-2xl text-slate-400 transition-all shadow-sm">
                                <X size={20} strokeWidth={3} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 overflow-y-auto max-h-[calc(90vh-140px)] custom-scrollbar space-y-8">
                            {/* Section: Basic Info */}
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 tracking-[0.2em] ml-2">JUDUL JADWAL</label>
                                    <input 
                                        type="text" required
                                        className="w-full px-6 py-4 bg-slate-50 border-0 rounded-2xl text-[13px] font-bold text-slate-700 focus:ring-4 focus:ring-indigo-100 transition-all outline-none"
                                        placeholder="Contoh: Pengecekan Mesin Genset Harian"
                                        value={formData.title}
                                        onChange={(e) => setFormData({...formData, title: e.target.value})}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 tracking-[0.2em] ml-2">PENERIMA TUGAS</label>
                                        <select 
                                            required
                                            className="w-full px-6 py-4 bg-slate-50 border-0 rounded-2xl text-[13px] font-bold text-slate-700 focus:ring-4 focus:ring-indigo-100 transition-all outline-none appearance-none"
                                            value={formData.assigneeId}
                                            onChange={(e) => setFormData({...formData, assigneeId: e.target.value})}
                                        >
                                            <option value="">Pilih Personil...</option>
                                            {staff.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 tracking-[0.2em] ml-2">FREKUENSI</label>
                                        <select 
                                            className="w-full px-6 py-4 bg-slate-50 border-0 rounded-2xl text-[13px] font-bold text-slate-700 focus:ring-4 focus:ring-indigo-100 transition-all outline-none appearance-none"
                                            value={formData.frequency}
                                            onChange={(e) => setFormData({...formData, frequency: e.target.value})}
                                        >
                                            <option value="DAILY">SETIAP HARI</option>
                                            <option value="WEEKLY">SETIAP MINGGU</option>
                                            <option value="MONTHLY">SETIAP BULAN</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Frequency Detail Picker */}
                                {formData.frequency === 'WEEKLY' && (
                                    <div className="space-y-2 animate-in slide-in-from-left-4 duration-300 bg-emerald-50/50 p-4 rounded-3xl border border-emerald-100/50">
                                        <label className="text-[10px] font-black text-emerald-600 tracking-widest block mb-2 px-2">PILIH HARI</label>
                                        <div className="flex flex-wrap gap-2">
                                            {['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'].map((day, idx) => (
                                                <button 
                                                    key={day} type="button"
                                                    onClick={() => setFormData({...formData, dayOfWeek: idx})}
                                                    className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all ${formData.dayOfWeek === idx ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'bg-white text-slate-400 hover:bg-emerald-50 hover:text-emerald-500'}`}
                                                >
                                                    {day.toUpperCase()}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {formData.frequency === 'MONTHLY' && (
                                    <div className="space-y-2 animate-in slide-in-from-left-4 duration-300 bg-amber-50/50 p-4 rounded-3xl border border-amber-100/50">
                                        <label className="text-[10px] font-black text-amber-600 tracking-widest block mb-2 px-2">TANGGAL BERAPA SETIAP BULAN?</label>
                                        <input 
                                            type="number" min="1" max="31"
                                            className="w-full px-6 py-4 bg-white border-0 rounded-2xl text-[13px] font-bold text-slate-700 focus:ring-4 focus:ring-amber-100 transition-all outline-none"
                                            value={formData.dayOfMonth}
                                            onChange={(e) => setFormData({...formData, dayOfMonth: e.target.value})}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Section: Checklist Builder */}
                            <div className="space-y-4 pt-4 border-t border-slate-50">
                                <label className="text-[10px] font-black text-slate-400 tracking-[0.2em] ml-2 flex items-center gap-2">
                                    <ListChecks size={14} /> ITEM PEKERJAAN (CHECKLIST)
                                </label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        placeholder="Tambah item pekerjaan..."
                                        className="flex-1 px-6 py-4 bg-slate-50 border-0 rounded-2xl text-[13px] font-bold text-slate-700 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                                        value={newItemText}
                                        onChange={(e) => setNewItemText(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddItem())}
                                    />
                                    <button 
                                        type="button"
                                        onClick={handleAddItem}
                                        className="px-6 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 active:scale-95 transition-all"
                                    >
                                        <Plus size={20} strokeWidth={3} />
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    {formData.items.map((item, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-4 bg-slate-50/30 border border-slate-100 rounded-2xl group animate-in slide-in-from-right-4 duration-200">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-[10px] font-black text-slate-300 shadow-sm">{idx + 1}</div>
                                                <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">{item.text}</span>
                                            </div>
                                            <button onClick={() => handleRemoveItem(idx)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                                                <X size={14} strokeWidth={3} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="flex flex-col gap-3 pt-6">
                                <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-[24px] font-black text-xs tracking-[0.3em] shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-4">
                                    {editingRoutine ? 'SIMPAN PERUBAHAN' : 'AKTIFKAN JADWAL'}
                                    <ArrowRight size={16} />
                                </button>
                                {editingRoutine && (
                                    <button 
                                        type="button"
                                        onClick={() => setFormData({...formData, isActive: !formData.isActive})}
                                        className={`w-full py-4 border-2 rounded-[24px] font-black text-[10px] tracking-widest transition-all ${formData.isActive ? 'border-rose-100 text-rose-500 bg-rose-50/20' : 'border-emerald-100 text-emerald-500 bg-emerald-50/20'}`}
                                    >
                                        {formData.isActive ? 'NONAKTIFKAN JADWAL INI' : 'AKTIFKAN KEMBALI JADWAL INI'}
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PersonnelRoutine;
