import { useState, useEffect } from 'react';
import { FileText, Download, Trash2, Plus, X, Upload, Calendar, User } from 'lucide-react';
import api from '../lib/axios';

const SarprasRules = () => {
    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [form, setForm] = useState({ title: '', description: '', file: null });

    const userStr = localStorage.getItem('user');
    const currentUser = userStr ? JSON.parse(userStr) : {};
    const isAdmin = ['SUPER_ADMIN'].includes(currentUser.role);

    useEffect(() => {
        fetchRules();
    }, []);

    const fetchRules = async () => {
        try {
            setLoading(true);
            const res = await api.get('/sarpras-rules');
            setRules(res.data);
        } catch (error) {
            console.error('Fetch rules error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!form.file) return alert('Pilih file terlebih dahulu');

        try {
            setUploading(true);
            const formData = new FormData();
            formData.append('title', form.title || form.file.name);
            formData.append('description', form.description);
            formData.append('file', form.file);

            await api.post('/sarpras-rules', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setShowUploadModal(false);
            setForm({ title: '', description: '', file: null });
            fetchRules();
        } catch (error) {
            console.error('Upload error:', error);
            alert(error.response?.data?.error || 'Gagal mengupload aturan');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Hapus aturan ini?')) return;
        try {
            await api.delete(`/sarpras-rules/${id}`);
            fetchRules();
        } catch (error) {
            console.error('Delete error:', error);
            alert('Gagal menghapus aturan');
        }
    };

    const formatSize = (bytes) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Aturan Sarana & Prasarana</h1>
                    <p className="text-slate-500 text-sm">Daftar aturan, prosedur, dan panduan manajemen Sarpras</p>
                </div>
                {isAdmin && (
                    <button
                        onClick={() => setShowUploadModal(true)}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all hover:bg-blue-700"
                    >
                        <Plus size={18} /> Upload Aturan
                    </button>
                )}
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-48 bg-slate-100 rounded-2xl border border-slate-200"></div>
                    ))}
                </div>
            ) : rules.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                        <FileText size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-700">Belum Ada Aturan</h3>
                    <p className="text-slate-400">Silakan upload aturan Sarpras yang berlaku.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {rules.map((rule) => (
                        <div key={rule.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col group">
                            <div className="p-5 flex-1">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                                        <FileText size={24} />
                                    </div>
                                    {isAdmin && (
                                        <button
                                            onClick={() => handleDelete(rule.id)}
                                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                </div>
                                <h3 className="font-bold text-slate-800 mb-1 group-hover:text-blue-600 transition-colors uppercase line-clamp-2">
                                    {rule.title}
                                </h3>
                                <p className="text-sm text-slate-500 line-clamp-2 mb-4">
                                    {rule.description || 'Tidak ada deskripsi.'}
                                </p>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                        <User size={12} /> {rule.uploadedBy?.name || rule.uploadedBy?.username}
                                    </div>
                                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                        <Calendar size={12} /> {new Date(rule.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </div>
                                </div>
                            </div>
                            <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    {formatSize(rule.fileSize)} • {rule.fileType?.split('/')[1]?.toUpperCase() || 'FILE'}
                                </span>
                                <a
                                    href={`${import.meta.env.VITE_API_URL}${rule.fileUrl}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm"
                                >
                                    <Download size={14} /> Download
                                </a>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-blue-50">
                            <h3 className="text-lg font-bold text-blue-900 flex items-center gap-2">
                                <Upload className="text-blue-600" /> Upload Aturan Baru
                            </h3>
                            <button onClick={() => setShowUploadModal(false)} className="p-2 hover:bg-white/50 rounded-full text-slate-500 hover:text-red-500 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleUpload} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Judul Aturan</label>
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={e => setForm({ ...form, title: e.target.value })}
                                    placeholder="Contoh: Prosedur Peminjaman Kendaraan"
                                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Deskripsi Singkat</label>
                                <textarea
                                    rows="3"
                                    value={form.description}
                                    onChange={e => setForm({ ...form, description: e.target.value })}
                                    placeholder="Jelaskan mengenai dokumen ini..."
                                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Pilih File (PDF/DOCX/JPG)</label>
                                <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-blue-400 transition-colors relative">
                                    <input
                                        type="file"
                                        onChange={e => setForm({ ...form, file: e.target.files[0] })}
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                    />
                                    <div className="flex flex-col items-center">
                                        <Upload size={32} className="text-slate-300 mb-2" />
                                        <p className="text-sm font-medium text-slate-600">
                                            {form.file ? form.file.name : 'Klik atau seret file ke sini'}
                                        </p>
                                        <p className="text-xs text-slate-400 mt-1">Maksimal 10MB</p>
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={uploading}
                                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg flex justify-center items-center gap-2 disabled:opacity-50"
                            >
                                {uploading ? (
                                    <>
                                        <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
                                        Sedang Mengupload...
                                    </>
                                ) : (
                                    <>Simpan Aturan</>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SarprasRules;
