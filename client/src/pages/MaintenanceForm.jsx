import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
    const [searchParams] = useSearchParams();
    const assetIdParam = searchParams.get('assetId');

    const [user] = useState(JSON.parse(localStorage.getItem('user') || '{}'));
    const [showAllSelected, setShowAllSelected] = useState(false);
    const [step, setStep] = useState(0); // 0: Choose Dept, 1: Fill Form
    const [form, setForm] = useState({
        title: '',
        type: 'NON_ASSET',
        category: 'INCIDENTAL',
        targetDept: '', // SARPRAS or PEMBANGUNAN
        selectedAssets: [], // Array of {id, label}
        description: '',
        location: '',
        urgency: 'NORMAL',
        isDirectOrder: false,
    });
    const [mediaFiles, setMediaFiles] = useState([]); // Array of { file, preview, type }
    const fileInputRef = useRef(null);

    const [unitsList, setUnitsList] = useState([]);
    const [usersList, setUsersList] = useState([]);
    const [assignUnitId, setAssignUnitId] = useState('');
    const [assignTechnician, setAssignTechnician] = useState('');

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowAssetDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Effect to handle assetId or assetIds from URL params
    useEffect(() => {
        const assetIdsParam = searchParams.get('assetIds');
        const assetIdParam = searchParams.get('assetId');
        const categoryParam = searchParams.get('category');

        if ((assetIdParam || assetIdsParam) && !form.title) {
            const fetchPreSelectedAssets = async () => {
                try {
                    const ids = assetIdsParam ? assetIdsParam.split(',') : [assetIdParam];
                    const selectedAssets = [];
                    
                    for (const id of ids) {
                        const res = await api.get(`/assets/${id}`);
                        const asset = res.data;
                        if (asset) {
                            selectedAssets.push({ id: asset.id, label: `${asset.code} - ${asset.name}` });
                        }
                    }

                    if (selectedAssets.length > 0) {
                        setForm(prev => ({
                            ...prev,
                            targetDept: 'SARPRAS',
                            type: 'ASSET',
                            category: categoryParam || prev.category,
                            title: categoryParam === 'ROUTINE' 
                                ? (selectedAssets.length > 1 ? `Pemeliharaan Rutin Massal (${selectedAssets.length} Aset)` : `Pemeliharaan Rutin: ${selectedAssets[0].label.split(' - ')[1]}`)
                                : prev.title,
                            selectedAssets: selectedAssets
                        }));
                        setStep(1);
                        setAssetSearch('');
                    }
                } catch (err) {
                    console.error('Failed to fetch pre-selected assets:', err);
                }
            };
            fetchPreSelectedAssets();
        }
    }, [assetIdParam, searchParams]);

    useEffect(() => {
        if (form.type === 'ASSET') {
            fetchAssets();
        }
    }, [form.type, form.category]);

    useEffect(() => {
        if (user.role === 'SUPER_ADMIN') {
            const fetchAssignmentData = async () => {
                try {
                    const [unitsRes, usersRes] = await Promise.all([
                        api.get('/master/units'),
                        api.get('/users')
                    ]);
                    setUnitsList(unitsRes.data.data || unitsRes.data || []);
                    setUsersList(usersRes.data.data || usersRes.data || []);
                } catch (err) {
                    console.error('Failed to fetch units or users:', err);
                }
            };
            fetchAssignmentData();
        }
    }, [user.role]);

    const fetchAssets = async () => {
        try {
            // Role check for full access or unit filter
            const isGlobalAdmin = ['SUPER_ADMIN', 'ADMIN_ASET', 'KEPALA_BIDANG', 'BIDANG_IT'].includes(user.role);
            const params = { limit: 9999 };
            if (!isGlobalAdmin && user.unitId) {
                params.unitId = user.unitId;
            }
            if (form.category === 'ROUTINE') {
                params.needsRoutine = true;
            }

            const res = await api.get('/assets', { params });
            setAssets(res.data.data || res.data || []);
        } catch (err) {
            console.error(err);
        }
    };

    const handleMediaChange = async (e) => {
        const selectedFiles = Array.from(e.target.files);
        if (selectedFiles.length === 0) return;

        const newMedia = [];

        for (const f of selectedFiles) {
            if (f.type.startsWith('image/')) {
                try {
                    // Compress image
                    const compressedFile = await compressImage(f, { maxWidth: 1200, quality: 0.8 });
                    const previewUrl = URL.createObjectURL(compressedFile);
                    newMedia.push({ file: compressedFile, preview: previewUrl, type: 'IMAGE', name: f.name });
                } catch (err) {
                    console.error('Compression failed for:', f.name, err);
                    const previewUrl = URL.createObjectURL(f);
                    newMedia.push({ file: f, preview: previewUrl, type: 'IMAGE', name: f.name });
                }
            } else if (f.type.startsWith('video/')) {
                // Video processing (no compression, just check size)
                if (f.size > 100 * 1024 * 1024) {
                    alert(`Video ${f.name} terlalu besar (>100MB). Silakan kompres atau perkecil resolusinya.`);
                    continue;
                }
                const previewUrl = URL.createObjectURL(f);
                newMedia.push({ file: f, preview: previewUrl, type: 'VIDEO', name: f.name });
            }
        }

        setMediaFiles(prev => [...prev, ...newMedia]);
        if (fileInputRef.current) fileInputRef.current.value = ""; // Reset input
    };

    const removeMedia = (index) => {
        setMediaFiles(prev => {
            const updated = [...prev];
            if (updated[index].preview) URL.revokeObjectURL(updated[index].preview);
            updated.splice(index, 1);
            return updated;
        });
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

    const filteredAssets = assets.filter(a => {
        const isNotSelected = !form.selectedAssets.some(sa => sa.id === a.id);
        const matchesSearch = (a.name?.toLowerCase() || '').includes(assetSearch.toLowerCase()) ||
            (a.code?.toLowerCase() || '').includes(assetSearch.toLowerCase()) ||
            (a.category?.name?.toLowerCase() || '').includes(assetSearch.toLowerCase());
        return isNotSelected && matchesSearch;
    });

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
            formData.append('urgency', form.urgency);
            formData.append('description', form.description);
            formData.append('location', form.location || '');
            if (form.isDirectOrder) {
                formData.append('isDirectOrder', 'true');
                if (assignTechnician) formData.append('technicianName', assignTechnician);
            }

            formData.append('targetDept', form.targetDept);

            if (form.type === 'ASSET') {
                const assetIds = form.selectedAssets.map(a => a.id);
                assetIds.forEach(id => formData.append('assetIds[]', id));
            }

            // Append all media files
            mediaFiles.forEach(m => {
                formData.append('media', m.file);
            });

            await api.post('/maintenance', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            alert('Laporan berhasil dibuat!');
            const targetParams = new URLSearchParams();
            if (form.targetDept) targetParams.set('targetDept', form.targetDept);
            if (form.category) targetParams.set('category', form.category);
            navigate(`/pemeliharaan?${targetParams.toString()}`);
        } catch (err) {
            alert(err.response?.data?.error || 'Gagal membuat laporan');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
                <button
                    onClick={() => step === 1 ? setStep(0) : navigate('/pemeliharaan')}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Wrench className="text-blue-600" />
                        {step === 0 ? 'Pilih Tujuan Laporan' : 'Buat Laporan'}
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        {step === 0 ? 'Tentukan kemana laporan ini akan diteruskan' : 'Isi detail laporan Anda'}
                    </p>
                </div>
            </div>

            {step === 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in zoom-in duration-300">
                    <button
                        onClick={() => {
                            setForm(prev => ({ ...prev, targetDept: 'SARPRAS' }));
                            setStep(1);
                        }}
                        className="group bg-white p-8 rounded-2xl border-2 border-slate-100 hover:border-blue-500 transition-all text-left shadow-sm hover:shadow-xl"
                    >
                        <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <Wrench size={28} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Laporan Pemeliharaan Aset</h3>
                        <p className="text-sm text-slate-500 leading-relaxed">
                            Laporan pemeliharaan aset (AC, Komputer, Kendaraan) atau kerusakan fasilitas umum (Lampu, Pintu, Air).
                        </p>
                        <div className="mt-6 flex items-center gap-2 text-blue-600 font-bold text-sm">
                            Pilih Bidang Ini <span className="group-hover:translate-x-1 transition-transform">→</span>
                        </div>
                    </button>

                    <button
                        onClick={() => {
                            setForm(prev => ({
                                ...prev,
                                targetDept: 'PEMBANGUNAN',
                                type: 'NON_ASSET',
                                category: 'INCIDENTAL'
                            }));
                            setStep(1);
                        }}
                        className="group bg-white p-8 rounded-2xl border-2 border-slate-100 hover:border-orange-500 transition-all text-left shadow-sm hover:shadow-xl"
                    >
                        <div className="w-14 h-14 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <Save size={28} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Laporan Pemeliharaan Bangunan</h3>
                        <p className="text-sm text-slate-500 leading-relaxed">
                            Permintaan Perbaikan Gedung (dinding, atap, plafon dan lain-lain).
                        </p>
                        <div className="mt-6 flex items-center gap-2 text-orange-600 font-bold text-sm">
                            Pilih Bidang Ini <span className="group-hover:translate-x-1 transition-transform">→</span>
                        </div>
                    </button>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-5 animate-in slide-in-from-right-4 duration-300">
                    {/* Header Info */}
                    <div className={`p-4 rounded-xl border flex items-center justify-between ${form.targetDept === 'PEMBANGUNAN' ? 'bg-orange-50 border-orange-100' : 'bg-blue-50 border-blue-100'}`}>
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold ${form.targetDept === 'PEMBANGUNAN' ? 'bg-orange-500' : 'bg-blue-500'}`}>
                                {form.targetDept === 'PEMBANGUNAN' ? 'PB' : 'SP'}
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Tujuan Laporan</p>
                                <p className={`text-sm font-bold ${form.targetDept === 'PEMBANGUNAN' ? 'text-orange-900' : 'text-blue-900'}`}>
                                    {form.targetDept === 'PEMBANGUNAN' ? 'Bidang Pembangunan' : 'Bidang Sarana & Prasarana'}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setStep(0)}
                            className="text-xs font-bold text-slate-400 hover:text-slate-600 underline"
                        >
                            Ubah
                        </button>
                    </div>

                    {form.targetDept === 'SARPRAS' && (
                        <>
                            {/* Category Selection */}
                            <div className="animate-in fade-in duration-500">
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
                        </>
                    )}

                    {/* Urgency Selection */}
                    <div className="animate-in slide-in-from-top-2 duration-500">
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-semibold text-slate-700">Tingkat Urgensi</label>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${form.urgency === 'NORMAL' ? 'bg-green-100 text-green-600' :
                                form.urgency === 'URGENT' ? 'bg-amber-100 text-amber-600' :
                                    'bg-red-100 text-red-600'
                                }`}>
                                {form.urgency === 'NORMAL' ? 'NORMAL' : form.urgency === 'URGENT' ? 'PENTING' : 'DARURAT'}
                            </span>
                        </div>
                        <div className="flex gap-2">
                            {[
                                { id: 'NORMAL', label: '🟢 Biasa', active: 'border-green-500 bg-green-50 text-green-700' },
                                { id: 'URGENT', label: '🟡 Penting', active: 'border-amber-500 bg-amber-50 text-amber-700' },
                                { id: 'EMERGENCY', label: '🔴 Darurat', active: 'border-red-500 bg-red-50 text-red-700' }
                            ].map(item => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setForm(prev => ({ ...prev, urgency: item.id }))}
                                    className={`flex-1 py-3 rounded-2xl border-2 text-xs font-bold transition-all shadow-sm ${form.urgency === item.id ? item.active : 'border-slate-100 bg-slate-50/50 text-slate-400 hover:border-slate-200'}`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>

                        {/* Direct Order Toggle (Super Admin Only) */}
                        {user.role === 'SUPER_ADMIN' && (
                            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                                <label className="flex items-center justify-between cursor-pointer">
                                    <div className="space-y-0.5">
                                        <span className="text-sm font-bold text-amber-900 flex items-center gap-2">
                                            👑 Penugasan Internal
                                        </span>
                                        <p className="text-[10px] text-amber-700 font-medium leading-tight">
                                            Laporan akan otomatis disetujui & ditugaskan langsung.
                                        </p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="w-5 h-5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                                        checked={form.isDirectOrder || false}
                                        onChange={e => setForm(prev => ({ ...prev, isDirectOrder: e.target.checked }))}
                                    />
                                </label>

                                {form.isDirectOrder && (
                                    <div className="mt-4 space-y-3 pt-3 border-t border-amber-200/50 animate-in fade-in duration-300">
                                        <div>
                                            <label className="block text-[11px] font-bold text-amber-900 mb-1">Pilih Unit Pegawai</label>
                                            <select
                                                value={assignUnitId}
                                                onChange={e => {
                                                    setAssignUnitId(e.target.value);
                                                    setAssignTechnician('');
                                                }}
                                                className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none text-slate-700"
                                            >
                                                <option value="">-- Pilih Unit --</option>
                                                {unitsList.map(u => (
                                                    <option key={u.id} value={u.id}>{u.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        {assignUnitId && (
                                            <div className="animate-in slide-in-from-top-2 duration-300">
                                                <label className="block text-[11px] font-bold text-amber-900 mb-1">Pilih Pegawai (Teknisi)</label>
                                                <select
                                                    value={assignTechnician}
                                                    onChange={e => setAssignTechnician(e.target.value)}
                                                    className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none text-slate-700"
                                                    required={form.isDirectOrder}
                                                >
                                                    <option value="">-- Pilih Pegawai --</option>
                                                    {usersList
                                                        .filter(u => 
                                                            u.unitId === parseInt(assignUnitId) && 
                                                            (
                                                                u.role === 'ADMIN_ASET' || 
                                                                (u.position && u.position.toLowerCase().includes('sarpras unit')) ||
                                                                (u.position && u.position.toLowerCase().includes('admin aset'))
                                                            )
                                                        )
                                                        .map(u => (
                                                            <option key={u.id} value={u.name || u.username}>{u.name || u.username}</option>
                                                        ))
                                                    }
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        <p className="text-[10px] text-slate-400 mt-2 px-1 flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                            {form.urgency === 'NORMAL' && "Gunakan untuk pemeliharaan rutin atau kerusakan kecil."}
                            {form.urgency === 'URGENT' && "Masalah yang menghambat fungsi namun aset masih bisa digunakan."}
                            {form.urgency === 'EMERGENCY' && "Kerusakan fatal yang membutuhkan penanganan segera (H-0)."}
                        </p>
                    </div>

                    {form.targetDept === 'SARPRAS' && (
                        <>
                            {/* Type Toggle */}
                            <div className="animate-in fade-in duration-500">
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
                        </>
                    )}

                    {/* Asset Selector (if ASSET) */}
                    {form.type === 'ASSET' && (
                        <div className="relative" ref={dropdownRef}>
                            <div className="flex justify-between items-end mb-2">
                                <label className="block text-sm font-semibold text-slate-700">Pilih Aset Terdata</label>
                                {form.selectedAssets.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setForm(prev => ({ ...prev, selectedAssets: [] }))}
                                        className="text-[10px] font-bold text-red-500 hover:underline"
                                    >
                                        HAPUS SEMUA ({form.selectedAssets.length})
                                    </button>
                                )}
                            </div>

                            {/* Selected Assets Tags / Summary */}
                            {form.selectedAssets.length > 0 && (
                                <div className="mb-4 bg-blue-50/50 border border-blue-100 rounded-2xl p-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    {form.selectedAssets.length <= 5 || showAllSelected ? (
                                        <div className="flex flex-wrap gap-2">
                                            {form.selectedAssets.map(asset => (
                                                <div key={asset.id} className="group flex items-center gap-2 bg-white text-blue-700 pl-3 pr-1.5 py-1.5 rounded-xl text-[11px] font-bold ring-1 ring-blue-200 shadow-sm transition-all hover:ring-blue-400">
                                                    <span>{asset.label}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeAsset(asset.id)}
                                                        className="w-5 h-5 flex items-center justify-center rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                            {form.selectedAssets.length > 5 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowAllSelected(false)}
                                                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 py-1.5 px-3"
                                                >
                                                    Sembunyikan ↑
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-lg shadow-blue-200">
                                                    {form.selectedAssets.length}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-blue-900">Aset Terpilih</p>
                                                    <p className="text-[10px] text-blue-600 font-medium truncate max-w-[200px] md:max-w-md">
                                                        {form.selectedAssets.slice(0, 3).map(a => a.label.split(' - ')[1]).join(', ')} ...dan {form.selectedAssets.length - 3} lainnya
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setShowAllSelected(true)}
                                                className="px-4 py-2 bg-white border border-blue-200 text-blue-600 text-[11px] font-bold rounded-xl shadow-sm hover:bg-blue-50 transition-colors"
                                            >
                                                Lihat Semua
                                            </button>
                                        </div>
                                    )}
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
                                                <div className="flex gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowAssetDropdown(false)}
                                                        className="text-slate-400 hover:text-slate-600 font-bold"
                                                    >
                                                        TUTUP
                                                    </button>
                                                </div>
                                            </div>
                                            {filteredAssets.slice(0, 100).map(a => {
                                                const isSelected = form.selectedAssets.some(sa => sa.id === a.id);
                                                return (
                                                    <button
                                                        key={a.id}
                                                        type="button"
                                                        onClick={() => {
                                                            toggleAssetSelection(a);
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

                    {/* Location */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">
                            {form.targetDept === 'PEMBANGUNAN' ? 'Lokasi Proyek / Gedung' : 'Lokasi / Objek'}
                        </label>
                        <input
                            type="text"
                            value={form.location}
                            onChange={e => setForm(prev => ({ ...prev, location: e.target.value }))}
                            placeholder={form.targetDept === 'PEMBANGUNAN' ? 'Misal: Asrama Putra Lt.3, Gerbang Utama...' : 'Misal: Atap Gedung A, Pipa Air Lantai 2...'}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

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

                    {/* Photo & Video Upload */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Media Bukti (Foto/Video - Maks 10)</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {mediaFiles.map((m, idx) => (
                                <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                                    {m.type === 'IMAGE' ? (
                                        <img src={m.preview} alt="Preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-slate-500">
                                            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">▶</div>
                                            <span className="text-[10px] px-2 text-center truncate w-full">{m.name}</span>
                                        </div>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => removeMedia(idx)}
                                        className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                            {mediaFiles.length < 10 && (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current.click()}
                                    className="aspect-square rounded-xl border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50 flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-blue-600 transition-all"
                                >
                                    <span className="text-2xl">+</span>
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Tambah Media</span>
                                </button>
                            )}
                        </div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            accept="image/*,video/mp4,video/quicktime"
                            onChange={handleMediaChange}
                            multiple
                            className="hidden"
                        />
                        <p className="mt-2 text-[10px] text-slate-400">
                            * Foto akan dikompres otomatis. Video maksimal 100MB.
                        </p>
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        <Save size={18} />
                        {saving ? 'Mengirim Laporan...' : 'Kirim Laporan'}
                    </button>
                </form>
            )}
        </div>
    );
};

export default MaintenanceForm;
