import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wrench, Save, ArrowLeft, Search } from 'lucide-react';
import api from '../lib/axios';
import { compressImage } from '../lib/media';

const MaintenanceForm = () => {
    const navigate = useNavigate();
    const [saving, setSaving] = useState(false);
    const [type, setType] = useState('NON_ASSET');
    const [assets, setAssets] = useState([]);
    const [assetSearch, setAssetSearch] = useState('');
    const [showAssetDropdown, setShowAssetDropdown] = useState(false);
    const dropdownRef = useRef(null);

    const [form, setForm] = useState({
        title: '',
        type: 'NON_ASSET',
        category: 'INCIDENTAL',
        selectedAssets: [], // Array of {id, label}
        description: '',
        location: '',
        photo: ''
    });
    const [file, setFile] = useState(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowAssetDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (form.type === 'ASSET') {
            fetchAssets();
        }
    }, [form.type]);

    const fetchAssets = async () => {
        try {
            const res = await api.get('/assets', { params: { limit: 9999 } });
            setAssets(res.data.data || res.data || []);
        } catch (err) {
            console.error(err);
        }
    };

    const handlePhotoChange = async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        
        try {
            // Compress image
            const compressedFile = await compressImage(f, { maxWidth: 1024, quality: 0.8 });
            
            // Cleanup old preview URL if any (if we were using one)
            if (form.photo && form.photo.startsWith('blob:')) {
                URL.revokeObjectURL(form.photo);
            }

            const previewUrl = URL.createObjectURL(compressedFile);
            setFile(compressedFile);
            setForm(prev => ({ ...prev, photo: previewUrl }));
            
            console.log('[DEBUG] Maintenance Photo Compressed:', {
                originalSize: (f.size / 1024).toFixed(1) + 'KB',
                compressedSize: (compressedFile.size / 1024).toFixed(1) + 'KB'
            });
        } catch (err) {
            console.error('Compression failed:', err);
            // Fallback
            const previewUrl = URL.createObjectURL(f);
            setFile(f);
            setForm(prev => ({ ...prev, photo: previewUrl }));
        }
    };

    const toggleAssetSelection = (asset) => {
        const isSelected = form.selectedAssets.some(a => a.id === asset.id);
        if (isSelected) {
            setForm(prev => ({
                ...prev,
                selectedAssets: prev.selectedAssets.filter(a => a.id !== asset.id)
            }));
        } else {
            setForm(prev => ({
                ...prev,
                selectedAssets: [...prev.selectedAssets, { id: asset.id, label: `${asset.code} - ${asset.name}` }]
            }));
        }
    };

    const removeAsset = (id) => {
        setForm(prev => ({
            ...prev,
            selectedAssets: prev.selectedAssets.filter(a => a.id !== id)
        }));
    };

    const filteredAssets = assets.filter(a =>
        (a.name?.toLowerCase() || '').includes(assetSearch.toLowerCase()) ||
        (a.code?.toLowerCase() || '').includes(assetSearch.toLowerCase())
    );

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.title) return alert('Judul wajib diisi');
        if (!form.description) return alert('Deskripsi masalah wajib diisi');
        if (form.type === 'ASSET' && form.selectedAssets.length === 0) return alert('Pilih minimal satu aset');

        try {
            setSaving(true);
            const formData = new FormData();
            formData.append('title', form.title);
            formData.append('type', form.type);
            formData.append('category', form.category);
            formData.append('description', form.description);
            formData.append('location', form.location || '');
            
            if (form.type === 'ASSET') {
                const assetIds = form.selectedAssets.map(a => a.id);
                assetIds.forEach(id => formData.append('assetIds[]', id));
            }

            if (file) {
                formData.append('photo', file);
            }

            await api.post('/maintenance', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            alert('Laporan berhasil dibuat!');
            navigate(form.category === 'ROUTINE' ? '/pemeliharaan?category=ROUTINE' : '/pemeliharaan?category=INCIDENTAL');
        } catch (err) {
            alert(err.response?.data?.error || 'Gagal membuat laporan');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
                <button onClick={() => navigate('/pemeliharaan')} className="p-2 hover:bg-slate-100 rounded-lg">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Wrench className="text-blue-600" /> Buat Laporan Pemeliharaan
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">Laporkan kerusakan atau permintaan pemeliharaan</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
                {/* Category Selection */}
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Kategori Pemeliharaan</label>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={() => setForm(prev => ({ ...prev, category: 'ROUTINE' }))}
                            className={`flex-1 p-3 rounded-xl border-2 text-sm font-semibold text-center transition-all ${form.category === 'ROUTINE' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                        >
                            📅 Rutin / Berkala
                        </button>
                        <button
                            type="button"
                            onClick={() => setForm(prev => ({ ...prev, category: 'INCIDENTAL' }))}
                            className={`flex-1 p-3 rounded-xl border-2 text-sm font-semibold text-center transition-all ${form.category === 'INCIDENTAL' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                        >
                            🚨 Insidentil / Perbaikan
                        </button>
                    </div>
                </div>

                {/* Type Toggle */}
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Jenis Laporan</label>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={() => { setForm(prev => ({ ...prev, type: 'ASSET' })); }}
                            className={`flex-1 p-3 rounded-xl border-2 text-sm font-semibold text-center transition-all ${form.type === 'ASSET' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                        >
                            🏷️ Aset Terdata
                        </button>
                        <button
                            type="button"
                            onClick={() => { setForm(prev => ({ ...prev, type: 'NON_ASSET', selectedAssets: [] })); }}
                            className={`flex-1 p-3 rounded-xl border-2 text-sm font-semibold text-center transition-all ${form.type === 'NON_ASSET' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                        >
                            📝 Non-Aset / Umum
                        </button>
                    </div>
                </div>

                {/* Asset Selector (if ASSET) */}
                {form.type === 'ASSET' && (
                    <div className="relative" ref={dropdownRef}>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Pilih Aset (Bisa lebih dari satu)</label>

                        {/* Selected Assets Tags */}
                        {form.selectedAssets.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                                {form.selectedAssets.map(asset => (
                                    <div key={asset.id} className="flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold ring-1 ring-blue-200">
                                        <span>{asset.label}</span>
                                        <button type="button" onClick={() => removeAsset(asset.id)} className="hover:text-red-500 transition-colors">×</button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Cari kode atau nama aset..."
                                value={assetSearch}
                                onChange={e => { setAssetSearch(e.target.value); setShowAssetDropdown(true); }}
                                onFocus={() => setShowAssetDropdown(true)}
                                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {showAssetDropdown && (
                            <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                {filteredAssets.length === 0 ? (
                                    <div className="p-4 text-sm text-slate-400 text-center">
                                        {assets.length === 0 ? 'Sedang memproses aset...' : 'Aset tidak ditemukan'}
                                    </div>
                                ) : (
                                    <>
                                        <div className="p-2 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex justify-between items-center">
                                            <span>{assetSearch ? `Hasil Pencarian (${filteredAssets.length})` : `Daftar Aset (${assets.length})`}</span>
                                            <button 
                                                type="button" 
                                                onClick={() => setShowAssetDropdown(false)}
                                                className="text-blue-600 hover:text-blue-800 font-bold"
                                            >
                                                TUTUP
                                            </button>
                                        </div>
                                        {filteredAssets.slice(0, 50).map(a => {
                                            const isSelected = form.selectedAssets.some(sa => sa.id === a.id);
                                            return (
                                                <button
                                                    key={a.id}
                                                    type="button"
                                                    onClick={() => {
                                                        toggleAssetSelection(a);
                                                        if (form.selectedAssets.length === 0) setAssetSearch('');
                                                    }}
                                                    className={`w-full text-left p-3 hover:bg-blue-50 border-b border-slate-100 text-sm flex items-center justify-between transition-colors ${isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
                                                >
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">{a.code}</span>
                                                            <span className="font-semibold text-slate-700">{a.name}</span>
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 mt-0.5">
                                                            {a.unit?.name} • {a.room?.name || 'Tanpa Ruangan'}
                                                        </div>
                                                    </div>
                                                    {isSelected && <span className="text-blue-600 font-bold">✓</span>}
                                                </button>
                                            );
                                        })}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Location (if NON_ASSET) */}
                {form.type === 'NON_ASSET' && (
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Lokasi / Objek</label>
                        <input
                            type="text"
                            value={form.location}
                            onChange={e => setForm(prev => ({ ...prev, location: e.target.value }))}
                            placeholder="Misal: Atap Gedung A, Pipa Air Lantai 2..."
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                )}

                {/* Title */}
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Judul Laporan *</label>
                    <input
                        type="text"
                        value={form.title}
                        onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Misal: AC Ruang Guru Tidak Dingin"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        required
                    />
                </div>

                {/* Description */}
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Deskripsi Masalah *</label>
                    <textarea
                        value={form.description}
                        onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Jelaskan kerusakan atau masalah yang terjadi secara detail..."
                        rows={4}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 resize-none"
                        required
                    />
                </div>

                {/* Photo Upload */}
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Foto Bukti (Opsional)</label>
                    <input type="file" accept="image/*" onChange={handlePhotoChange} className="text-sm" />
                    {form.photo && (
                        <img src={form.photo} alt="Preview" className="mt-2 w-40 h-40 object-cover rounded-lg border" />
                    )}
                </div>

                {/* Submit */}
                <button
                    type="submit"
                    disabled={saving}
                    className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    <Save size={18} />
                    {saving ? 'Menyimpan...' : 'Kirim Laporan'}
                </button>
            </form>
        </div>
    );
};

export default MaintenanceForm;
