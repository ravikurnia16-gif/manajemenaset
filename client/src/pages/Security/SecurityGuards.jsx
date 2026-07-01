import { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Edit2, ShieldCheck, X, Phone, Calendar } from 'lucide-react';
import api from '../../../lib/axios';

const SecurityGuards = () => {
    const [guards, setGuards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingGuard, setEditingGuard] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        status: 'ACTIVE',
        joinDate: '',
        note: ''
    });

    useEffect(() => {
        fetchGuards();
    }, []);

    const fetchGuards = async () => {
        try {
            const res = await api.get('/security/guards');
            setGuards(res.data);
        } catch (error) {
            console.error('Failed to fetch guards', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingGuard) {
                await api.put(`/security/guards/${editingGuard.id}`, formData);
            } else {
                await api.post('/security/guards', formData);
            }
            setShowModal(false);
            fetchGuards();
            resetForm();
        } catch (error) {
            alert('Failed to save guard: ' + (error.response?.data?.error || error.message));
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Yakin ingin menghapus data anggota ini?')) return;
        try {
            await api.delete(`/security/guards/${id}`);
            fetchGuards();
        } catch (error) {
            alert('Failed to delete guard: ' + error.message);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            phone: '',
            status: 'ACTIVE',
            joinDate: '',
            note: ''
        });
        setEditingGuard(null);
    };

    const openEdit = (guard) => {
        setEditingGuard(guard);
        setFormData({
            name: guard.name,
            phone: guard.phone || '',
            status: guard.status,
            joinDate: guard.joinDate ? new Date(guard.joinDate).toISOString().split('T')[0] : '',
            note: guard.note || ''
        });
        setShowModal(true);
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'ACTIVE': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
            case 'CUTI': return 'bg-amber-50 text-amber-600 border-amber-100';
            case 'NONAKTIF': return 'bg-rose-50 text-rose-600 border-rose-100';
            default: return 'bg-slate-50 text-slate-600 border-slate-100';
        }
    };

    return (
        <div className="p-4 md:p-8 bg-[#F8FAFC] min-h-screen pt-20 pb-24">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-100 flex items-center justify-center">
                                <Users className="text-white" size={24} />
                            </div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight italic uppercase">
                                DATA <span className="text-indigo-600">ANGGOTA</span>
                            </h1>
                        </div>
                        <p className="text-sm font-medium text-slate-400 pl-14">
                            Kelola data personil security
                        </p>
                    </div>

                    <button 
                        onClick={() => { resetForm(); setShowModal(true); }}
                        className="flex items-center justify-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs tracking-widest shadow-2xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95 group"
                    >
                        <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" />
                        TAMBAH ANGGOTA
                    </button>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {loading ? (
                        <div className="col-span-full py-20 flex flex-col items-center gap-4">
                            <ShieldCheck className="animate-pulse text-indigo-200" size={48} />
                            <p className="text-[10px] font-black tracking-widest text-slate-300 uppercase">Memuat Data...</p>
                        </div>
                    ) : guards.length === 0 ? (
                        <div className="col-span-full py-20 bg-white rounded-[40px] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center gap-4 grayscale opacity-40">
                            <Users size={48} />
                            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Belum ada data anggota</p>
                        </div>
                    ) : (
                        guards.map((g) => (
                            <div key={g.id} className="bg-white rounded-[32px] p-6 shadow-xl shadow-slate-100/40 border border-slate-50 transition-all hover:scale-[1.02] hover:shadow-2xl hover:shadow-slate-200 group relative overflow-hidden">
                                <div className={`absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full blur-3xl opacity-10 transition-colors bg-indigo-600`} />
                                
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`px-3 py-1 rounded-full border text-[9px] font-black tracking-widest shadow-sm ${getStatusStyle(g.status)}`}>
                                        {g.status}
                                    </div>
                                    <div className="flex gap-2 relative z-10">
                                        <button onClick={() => openEdit(g)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                                            <Edit2 size={14} />
                                        </button>
                                        <button onClick={() => handleDelete(g.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex flex-col items-center text-center space-y-4">
                                    {g.photo ? (
                                        <img src={g.photo} alt={g.name} className="w-20 h-20 rounded-full object-cover shadow-lg border-4 border-white" />
                                    ) : (
                                        <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center text-2xl font-black shadow-inner border-4 border-white">
                                            {g.name.charAt(0)}
                                        </div>
                                    )}
                                    <div>
                                        <h3 className="text-lg font-black text-slate-900 leading-tight group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{g.name}</h3>
                                        {g.phone && <p className="text-xs font-bold text-slate-400 mt-1 flex items-center justify-center gap-1"><Phone size={10}/> {g.phone}</p>}
                                    </div>
                                </div>
                                {g.joinDate && (
                                    <div className="mt-6 pt-4 border-t border-slate-50 text-center">
                                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest flex items-center justify-center gap-1"><Calendar size={10}/> Bergabung: {new Date(g.joinDate).toLocaleDateString('id-ID')}</span>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Modal Form */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setShowModal(false)} />
                    <div className="bg-white rounded-[40px] w-full max-w-lg max-h-[90vh] overflow-hidden relative shadow-2xl animate-in zoom-in slide-in-from-bottom-10 duration-300">
                        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                            <div>
                                <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">
                                    {editingGuard ? 'EDIT' : 'TAMBAH'} <span className="text-indigo-600 tracking-widest">ANGGOTA</span>
                                </h2>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-3 hover:bg-white rounded-2xl text-slate-400 transition-all shadow-sm">
                                <X size={20} strokeWidth={3} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 overflow-y-auto max-h-[calc(90vh-140px)] custom-scrollbar space-y-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 tracking-[0.2em] ml-2">NAMA LENGKAP</label>
                                <input 
                                    type="text" required
                                    className="w-full px-6 py-4 bg-slate-50 border-0 rounded-2xl text-[13px] font-bold text-slate-700 focus:ring-4 focus:ring-indigo-100 transition-all outline-none"
                                    value={formData.name}
                                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 tracking-[0.2em] ml-2">NO HP / WHATSAPP</label>
                                <input 
                                    type="text" 
                                    className="w-full px-6 py-4 bg-slate-50 border-0 rounded-2xl text-[13px] font-bold text-slate-700 focus:ring-4 focus:ring-indigo-100 transition-all outline-none"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 tracking-[0.2em] ml-2">TANGGAL BERGABUNG</label>
                                    <input 
                                        type="date" 
                                        className="w-full px-6 py-4 bg-slate-50 border-0 rounded-2xl text-[13px] font-bold text-slate-700 focus:ring-4 focus:ring-indigo-100 transition-all outline-none"
                                        value={formData.joinDate}
                                        onChange={(e) => setFormData({...formData, joinDate: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 tracking-[0.2em] ml-2">STATUS</label>
                                    <select 
                                        className="w-full px-6 py-4 bg-slate-50 border-0 rounded-2xl text-[13px] font-bold text-slate-700 focus:ring-4 focus:ring-indigo-100 transition-all outline-none appearance-none"
                                        value={formData.status}
                                        onChange={(e) => setFormData({...formData, status: e.target.value})}
                                    >
                                        <option value="ACTIVE">AKTIF</option>
                                        <option value="CUTI">CUTI</option>
                                        <option value="NONAKTIF">NONAKTIF</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 tracking-[0.2em] ml-2">CATATAN</label>
                                <textarea 
                                    rows="2"
                                    className="w-full px-6 py-4 bg-slate-50 border-0 rounded-2xl text-[13px] font-bold text-slate-700 focus:ring-4 focus:ring-indigo-100 transition-all outline-none resize-none"
                                    value={formData.note}
                                    onChange={(e) => setFormData({...formData, note: e.target.value})}
                                />
                            </div>

                            <button type="submit" className="w-full py-5 mt-4 bg-slate-900 text-white rounded-[24px] font-black text-xs tracking-[0.3em] shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95">
                                SIMPAN DATA
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SecurityGuards;
