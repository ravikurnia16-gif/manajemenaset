import { useState, useEffect } from 'react';
import { FileText, Download, Trash2, Plus, X, Upload, Calendar, User, Folder, FolderOpen, ChevronRight, Search, FolderPlus, Eye } from 'lucide-react';
import api from '../lib/axios';

const SarprasRules = () => {
    const [rules, setRules] = useState([]);
    const [folders, setFolders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showFolderModal, setShowFolderModal] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [creatingFolder, setCreatingFolder] = useState(false);
    const [form, setForm] = useState({ title: '', description: '', folderId: '', file: null });
    const [newFolderName, setNewFolderName] = useState('');
    const [selectedFolder, setSelectedFolder] = useState('Semua');
    const [searchQuery, setSearchQuery] = useState('');

    const userStr = localStorage.getItem('user');
    const currentUser = userStr ? JSON.parse(userStr) : {};
    const isAdmin = ['SUPER_ADMIN', 'BIDANG_IT'].includes(currentUser.role);

    useEffect(() => {
        initData();
    }, []);

    const initData = async () => {
        setLoading(true);
        await Promise.all([fetchRules(), fetchFolders()]);
        setLoading(false);
    };

    const fetchRules = async () => {
        try {
            const res = await api.get('/sarpras-rules');
            setRules(res.data);
        } catch (error) {
            console.error('Fetch rules error:', error);
        }
    };

    const fetchFolders = async () => {
        try {
            const res = await api.get('/sarpras-folders');
            setFolders(res.data);
        } catch (error) {
            console.error('Fetch folders error:', error);
        }
    };

    const filteredRules = rules.filter(rule => {
        const matchesFolder = selectedFolder === 'Semua' || rule.folderId === parseInt(selectedFolder);
        const matchesSearch = rule.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            rule.description?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesFolder && matchesSearch;
    });

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!form.file) return alert('Pilih file terlebih dahulu');
        if (!form.folderId) return alert('Pilih folder terlebih dahulu');

        try {
            setUploading(true);
            const formData = new FormData();
            formData.append('title', form.title || form.file.name);
            formData.append('description', form.description);
            formData.append('folderId', form.folderId);
            formData.append('file', form.file);

            await api.post('/sarpras-rules', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setShowUploadModal(false);
            setForm({ title: '', description: '', folderId: '', file: null });
            fetchRules();
        } catch (error) {
            console.error('Upload error:', error);
            alert(error.response?.data?.error || 'Gagal mengupload Dokumen');
        } finally {
            setUploading(false);
        }
    };

    const handleCreateFolder = async (e) => {
        e.preventDefault();
        if (!newFolderName.trim()) return;

        try {
            setCreatingFolder(true);
            await api.post('/sarpras-folders', { name: newFolderName });
            setNewFolderName('');
            setShowFolderModal(false);
            fetchFolders();
        } catch (error) {
            alert(error.response?.data?.error || 'Gagal membuat folder');
        } finally {
            setCreatingFolder(false);
        }
    };

    const handleDeleteFolder = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm('Hapus folder ini? Pastikan folder dalam keadaan kosong.')) return;
        try {
            await api.delete(`/sarpras-folders/${id}`);
            if (selectedFolder === id.toString()) setSelectedFolder('Semua');
            fetchFolders();
        } catch (error) {
            alert(error.response?.data?.error || 'Gagal menghapus folder');
        }
    };

    const handleDeleteRule = async (id) => {
        if (!window.confirm('Hapus Dokumen ini?')) return;
        try {
            await api.delete(`/sarpras-rules/${id}`);
            fetchRules();
        } catch (error) {
            console.error('Delete error:', error);
            alert('Gagal menghapus Dokumen');
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
        <div className="flex flex-col md:flex-row h-[calc(100vh-64px)] overflow-hidden bg-slate-50">
            {/* Sidebar Folder */}
            <div className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                    <h2 className="font-bold text-slate-800 flex items-center gap-2">
                        <Folder className="text-blue-600" size={18} /> Direktori
                    </h2>
                    {isAdmin && (
                        <button
                            onClick={() => setShowFolderModal(true)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Tambah Folder"
                        >
                            <FolderPlus size={18} />
                        </button>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    <button
                        onClick={() => setSelectedFolder('Semua')}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${selectedFolder === 'Semua'
                            ? 'bg-blue-50 text-blue-700 shadow-sm'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                    >
                        {selectedFolder === 'Semua' ? <FolderOpen size={16} /> : <Folder size={16} />}
                        <span className="truncate">Semua Dokumen</span>
                        {selectedFolder === 'Semua' && <ChevronRight size={14} className="ml-auto" />}
                    </button>

                    {folders.map(folder => (
                        <button
                            key={folder.id}
                            onClick={() => setSelectedFolder(folder.id.toString())}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${selectedFolder === folder.id.toString()
                                ? 'bg-blue-50 text-blue-700 shadow-sm'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                }`}
                        >
                            {selectedFolder === folder.id.toString() ? <FolderOpen size={16} /> : <Folder size={16} />}
                            <span className="truncate flex-1 text-left">{folder.name}</span>
                            {isAdmin && folder._count?.rules === 0 && (
                                <X
                                    size={14}
                                    className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                    onClick={(e) => handleDeleteFolder(e, folder.id)}
                                />
                            )}
                            {selectedFolder === folder.id.toString() && <ChevronRight size={14} className="ml-2" />}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <div className="p-4 md:p-6 bg-white border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight">Dokumen Sarpras</h1>
                        <p className="text-slate-500 text-xs md:text-sm">
                            Lokasi: <span className="font-semibold text-blue-600">
                                {selectedFolder === 'Semua' ? 'Semua Dokumen' : folders.find(f => f.id.toString() === selectedFolder)?.name}
                            </span>
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative group flex-1 md:flex-none">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16} />
                            <input
                                type="text"
                                placeholder="Cari dokumen..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-64 transition-all"
                            />
                        </div>
                        {isAdmin && (
                            <button
                                onClick={() => setShowUploadModal(true)}
                                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all hover:bg-blue-700 whitespace-nowrap"
                            >
                                <Plus size={18} /> <span className="hidden sm:inline">Upload</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6">
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-pulse">
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className="h-48 bg-slate-200/50 rounded-2xl border border-slate-200"></div>
                            ))}
                        </div>
                    ) : filteredRules.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-12">
                            <div className="w-20 h-20 bg-white border border-dashed border-slate-300 rounded-3xl flex items-center justify-center mb-4 text-slate-300 shadow-sm">
                                <FileText size={40} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-700">Tidak Ada Dokumen</h3>
                            <p className="text-slate-400 text-sm max-w-xs mx-auto">
                                {searchQuery ? `Tidak ada hasil untuk "${searchQuery}"` : `Belum ada dokumen di folder ini.`}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-12">
                            {filteredRules.map((rule) => (
                                <div key={rule.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col group border-l-4 border-l-blue-500">
                                    <div className="p-5 flex-1">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                                                {rule.folder?.name || 'Tidak Dikategorikan'}
                                            </div>
                                            {isAdmin && (
                                                <button
                                                    onClick={() => handleDeleteRule(rule.id)}
                                                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                        <h3 className="font-bold text-slate-800 mb-2 group-hover:text-blue-600 transition-colors uppercase line-clamp-2 leading-tight">
                                            {rule.title}
                                        </h3>
                                        <p className="text-xs text-slate-500 line-clamp-2 mb-4">
                                            {rule.description || 'Tidak ada deskripsi.'}
                                        </p>
                                        <div className="flex items-center gap-4 text-[10px] text-slate-400 font-medium">
                                            <div className="flex items-center gap-1">
                                                <User size={12} /> {rule.uploadedBy?.name || rule.uploadedBy?.username}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Calendar size={12} /> {new Date(rule.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                                            {formatSize(rule.fileSize)} • {rule.fileType?.split('/')[1]?.toUpperCase() || 'FILE'}
                                        </span>
                                        <div className="flex gap-2">
                                            <a
                                                href={rule.fileUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 transition-all shadow-sm"
                                            >
                                                <Eye size={14} /> Lihat
                                            </a>
                                            <a
                                                href={rule.fileUrl}
                                                download
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 bg-blue-600 text-white border border-transparent px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 transition-all shadow-sm shadow-blue-200"
                                            >
                                                <Download size={14} /> Download
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-blue-600">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Upload size={20} /> Upload Dokumen Baru
                            </h3>
                            <button onClick={() => setShowUploadModal(false)} className="p-2 hover:bg-white/20 rounded-full text-white/80 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleUpload} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 sm:col-span-1">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Judul Dokumen</label>
                                    <input
                                        type="text"
                                        value={form.title}
                                        onChange={e => setForm({ ...form, title: e.target.value })}
                                        placeholder="Nama dokumen..."
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        required
                                    />
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Folder Tujuan</label>
                                    <select
                                        value={form.folderId}
                                        onChange={e => setForm({ ...form, folderId: e.target.value })}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        required
                                    >
                                        <option value="">-- Pilih Folder --</option>
                                        {folders.map(f => (
                                            <option key={f.id} value={f.id}>{f.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Deskripsi Singkat</label>
                                <textarea
                                    rows="2"
                                    value={form.description}
                                    onChange={e => setForm({ ...form, description: e.target.value })}
                                    placeholder="Apa isi dokumen ini?"
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Berkas (PDF/DOCX/Gambar)</label>
                                <div className="border-2 border-dashed border-slate-200 bg-slate-50 rounded-2xl p-8 text-center hover:border-blue-400 hover:bg-blue-50/30 transition-all relative group cursor-pointer">
                                    <input
                                        type="file"
                                        onChange={e => setForm({ ...form, file: e.target.files[0] })}
                                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                    />
                                    <div className="flex flex-col items-center">
                                        <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-slate-400 group-hover:text-blue-500 group-hover:scale-110 transition-all mb-3">
                                            <Upload size={24} />
                                        </div>
                                        <p className="text-sm font-bold text-slate-600 group-hover:text-blue-700 transition-colors">
                                            {form.file ? form.file.name : 'Pilih file atau tarik ke sini'}
                                        </p>
                                        <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-bold">Maks 10MB • PDF, DOC, IMG</p>
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={uploading}
                                className="w-full bg-blue-600 text-white py-3.5 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg hover:shadow-blue-500/20 flex justify-center items-center gap-2 disabled:opacity-50 mt-2"
                            >
                                {uploading ? (
                                    <>
                                        <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                                        Sedang Mengupload...
                                    </>
                                ) : (
                                    <>Simpan Dokumen</>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Create Folder Modal */}
            {showFolderModal && (
                <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-blue-600">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <FolderPlus size={20} /> Tambah Folder
                            </h3>
                            <button onClick={() => setShowFolderModal(false)} className="p-2 hover:bg-white/20 rounded-full text-white/80 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateFolder} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nama Folder</label>
                                <input
                                    type="text"
                                    value={newFolderName}
                                    onChange={e => setNewFolderName(e.target.value)}
                                    placeholder="Contoh: Kepegawaian"
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    required
                                    autoFocus
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={creatingFolder}
                                className="w-full bg-blue-600 text-white py-3 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg flex justify-center items-center gap-2 disabled:opacity-50"
                            >
                                {creatingFolder ? 'Menciptakan...' : 'Buat Folder'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SarprasRules;
