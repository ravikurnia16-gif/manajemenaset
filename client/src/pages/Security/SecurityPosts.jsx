import { useState, useEffect } from 'react';
import { MapPin, Plus, Trash2, Edit2, ShieldCheck, X } from 'lucide-react';
import api from '../../../lib/axios';

const SecurityPosts = () => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingPost, setEditingPost] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        location: '',
        description: '',
        capacity: 1,
        isActive: true
    });

    useEffect(() => {
        fetchPosts();
    }, []);

    const fetchPosts = async () => {
        try {
            const res = await api.get('/security/posts');
            setPosts(res.data);
        } catch (error) {
            console.error('Failed to fetch posts', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingPost) {
                await api.put(`/security/posts/${editingPost.id}`, formData);
            } else {
                await api.post('/security/posts', formData);
            }
            setShowModal(false);
            fetchPosts();
            resetForm();
        } catch (error) {
            alert('Failed to save post: ' + (error.response?.data?.error || error.message));
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Yakin ingin menghapus pos ini?')) return;
        try {
            await api.delete(`/security/posts/${id}`);
            fetchPosts();
        } catch (error) {
            alert('Failed to delete post: ' + error.message);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            location: '',
            description: '',
            capacity: 1,
            isActive: true
        });
        setEditingPost(null);
    };

    const openEdit = (post) => {
        setEditingPost(post);
        setFormData({
            name: post.name,
            location: post.location || '',
            description: post.description || '',
            capacity: post.capacity,
            isActive: post.isActive
        });
        setShowModal(true);
    };

    return (
        <div className="p-4 md:p-8 bg-[#F8FAFC] min-h-screen pt-20 pb-24">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-100 flex items-center justify-center">
                                <MapPin className="text-white" size={24} />
                            </div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight italic uppercase">
                                DATA <span className="text-indigo-600">POS SECURITY</span>
                            </h1>
                        </div>
                        <p className="text-sm font-medium text-slate-400 pl-14">
                            Kelola titik-titik penjagaan dan kapasitas tiap pos
                        </p>
                    </div>

                    <button 
                        onClick={() => { resetForm(); setShowModal(true); }}
                        className="flex items-center justify-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs tracking-widest shadow-2xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95 group"
                    >
                        <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" />
                        TAMBAH POS BARU
                    </button>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading ? (
                        <div className="col-span-full py-20 flex flex-col items-center gap-4">
                            <ShieldCheck className="animate-pulse text-indigo-200" size={48} />
                            <p className="text-[10px] font-black tracking-widest text-slate-300 uppercase">Memuat Data...</p>
                        </div>
                    ) : posts.length === 0 ? (
                        <div className="col-span-full py-20 bg-white rounded-[40px] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center gap-4 grayscale opacity-40">
                            <MapPin size={48} />
                            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Belum ada data pos</p>
                        </div>
                    ) : (
                        posts.map((p) => (
                            <div key={p.id} className="bg-white rounded-[32px] p-6 shadow-xl shadow-slate-100/40 border border-slate-50 transition-all hover:scale-[1.02] hover:shadow-2xl hover:shadow-slate-200 group relative overflow-hidden">
                                <div className={`absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full blur-3xl opacity-10 transition-colors ${p.isActive ? 'bg-indigo-600' : 'bg-rose-400'}`} />
                                
                                <div className="flex justify-between items-start mb-6">
                                    <div className={`px-3 py-1 rounded-full border text-[9px] font-black tracking-widest shadow-sm ${p.isActive ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                        {p.isActive ? 'AKTIF' : 'NONAKTIF'}
                                    </div>
                                    <div className="flex gap-2 relative z-10">
                                        <button onClick={() => openEdit(p)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                                            <Edit2 size={16} />
                                        </button>
                                        <button onClick={() => handleDelete(p.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <h3 className="text-lg font-black text-slate-900 leading-tight group-hover:text-indigo-600 transition-colors uppercase italic tracking-tight">{p.name}</h3>
                                        <p className="text-xs font-bold text-slate-400 mt-1 flex items-center gap-1"><MapPin size={12}/> {p.location || 'Lokasi tidak diset'}</p>
                                    </div>

                                    <div className="bg-slate-50/50 rounded-2xl p-4 flex justify-between items-center">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">KAPASITAS SHIFT</span>
                                            <span className="text-sm font-black text-slate-700">{p.capacity} Anggota</span>
                                        </div>
                                    </div>
                                    <p className="text-xs font-medium text-slate-500 line-clamp-2">{p.description}</p>
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
                    <div className="bg-white rounded-[40px] w-full max-w-lg max-h-[90vh] overflow-hidden relative shadow-2xl animate-in zoom-in slide-in-from-bottom-10 duration-300">
                        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                            <div>
                                <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">
                                    {editingPost ? 'EDIT' : 'TAMBAH'} <span className="text-indigo-600 tracking-widest">POS</span>
                                </h2>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-3 hover:bg-white rounded-2xl text-slate-400 transition-all shadow-sm">
                                <X size={20} strokeWidth={3} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 overflow-y-auto max-h-[calc(90vh-140px)] custom-scrollbar space-y-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 tracking-[0.2em] ml-2">NAMA POS</label>
                                <input 
                                    type="text" required
                                    className="w-full px-6 py-4 bg-slate-50 border-0 rounded-2xl text-[13px] font-bold text-slate-700 focus:ring-4 focus:ring-indigo-100 transition-all outline-none"
                                    placeholder="Contoh: Pos 1 Gerbang Utama"
                                    value={formData.name}
                                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 tracking-[0.2em] ml-2">LOKASI</label>
                                <input 
                                    type="text" 
                                    className="w-full px-6 py-4 bg-slate-50 border-0 rounded-2xl text-[13px] font-bold text-slate-700 focus:ring-4 focus:ring-indigo-100 transition-all outline-none"
                                    placeholder="Contoh: Area Depan Gedung A"
                                    value={formData.location}
                                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 tracking-[0.2em] ml-2">DESKRIPSI TUGAS POS</label>
                                <textarea 
                                    rows="3"
                                    className="w-full px-6 py-4 bg-slate-50 border-0 rounded-2xl text-[13px] font-bold text-slate-700 focus:ring-4 focus:ring-indigo-100 transition-all outline-none resize-none"
                                    placeholder="Keterangan operasional pos..."
                                    value={formData.description}
                                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 tracking-[0.2em] ml-2">KAPASITAS (ORANG/SHIFT)</label>
                                    <input 
                                        type="number" min="1" required
                                        className="w-full px-6 py-4 bg-slate-50 border-0 rounded-2xl text-[13px] font-bold text-slate-700 focus:ring-4 focus:ring-indigo-100 transition-all outline-none"
                                        value={formData.capacity}
                                        onChange={(e) => setFormData({...formData, capacity: parseInt(e.target.value)})}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 tracking-[0.2em] ml-2">STATUS</label>
                                    <select 
                                        className="w-full px-6 py-4 bg-slate-50 border-0 rounded-2xl text-[13px] font-bold text-slate-700 focus:ring-4 focus:ring-indigo-100 transition-all outline-none appearance-none"
                                        value={formData.isActive ? "true" : "false"}
                                        onChange={(e) => setFormData({...formData, isActive: e.target.value === "true"})}
                                    >
                                        <option value="true">AKTIF</option>
                                        <option value="false">NONAKTIF</option>
                                    </select>
                                </div>
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

export default SecurityPosts;
