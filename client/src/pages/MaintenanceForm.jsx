import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wrench, Save, ArrowLeft, Search } from 'lucide-react';
import api from '../lib/axios';

const MaintenanceForm = () => {
    const navigate = useNavigate();
    const [saving, setSaving] = useState(false);
    const [type, setType] = useState('NON_ASSET');
    const [assets, setAssets] = useState([]);
    const [assetSearch, setAssetSearch] = useState('');
    const [showAssetDropdown, setShowAssetDropdown] = useState(false);

    const [form, setForm] = useState({
        title: '',
        type: 'NON_ASSET',
        assetId: null,
        assetLabel: '',
        description: '',
        location: '',
        photo: ''
    });

    useEffect(() => {
        if (type === 'ASSET') {
            fetchAssets();
        }
    }, [type]);

    const fetchAssets = async () => {
        try {
            const res = await api.get('/assets', { params: { limit: 9999 } });
            setAssets(res.data.data || res.data || []);
        } catch (err) {
            console.error(err);
        }
    };

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            alert('Ukuran foto maksimal 2MB');
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            setForm(prev => ({ ...prev, photo: reader.result }));
        };
        reader.readAsDataURL(file);
    };

    const selectAsset = (asset) => {
        setForm(prev => ({
            ...prev,
            assetId: asset.id,
            assetLabel: `${asset.code} - ${asset.name}`
        }));
        setAssetSearch('');
        setShowAssetDropdown(false);
    };

    const filteredAssets = assets.filter(a =>
        (a.name?.toLowerCase() || '').includes(assetSearch.toLowerCase()) ||
        (a.code?.toLowerCase() || '').includes(assetSearch.toLowerCase())
    );

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.title) return alert('Judul wajib diisi');
        if (!form.description) return alert('Deskripsi masalah wajib diisi');
        if (type === 'ASSET' && !form.assetId) return alert('Pilih aset yang bermasalah');

        try {
            setSaving(true);
            await api.post('/maintenance', {
                title: form.title,
                type,
                assetId: type === 'ASSET' ? form.assetId : null,
                description: form.description,
                location: form.location || null,
                photo: form.photo || null
            });
            alert('Laporan berhasil dibuat!');
            navigate('/pemeliharaan');
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
                {/* Type Toggle */}
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Jenis Laporan</label>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={() => { setType('ASSET'); setForm(prev => ({ ...prev, type: 'ASSET' })); }}
                            className={`flex-1 p-3 rounded-xl border-2 text-sm font-semibold text-center transition-all ${type === 'ASSET' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                        >
                            🏷️ Aset Terdata
                        </button>
                        <button
                            type="button"
                            onClick={() => { setType('NON_ASSET'); setForm(prev => ({ ...prev, type: 'NON_ASSET', assetId: null, assetLabel: '' })); }}
                            className={`flex-1 p-3 rounded-xl border-2 text-sm font-semibold text-center transition-all ${type === 'NON_ASSET' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                        >
                            📝 Non-Aset / Umum
                        </button>
                    </div>
                </div>

                {/* Asset Selector (if ASSET) */}
                {type === 'ASSET' && (
                    <div className="relative">
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Pilih Aset</label>
                        {form.assetLabel ? (
                            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <span className="flex-1 text-sm font-medium text-blue-800">{form.assetLabel}</span>
                                <button type="button" onClick={() => setForm(prev => ({ ...prev, assetId: null, assetLabel: '' }))} className="text-red-500 text-xs font-bold">Ganti</button>
                            </div>
                        ) : (
                            <div>
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
                                {showAssetDropdown && assetSearch && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                        {filteredAssets.length === 0 ? (
                                            <div className="p-3 text-sm text-slate-400 text-center">Tidak ditemukan</div>
                                        ) : (
                                            filteredAssets.slice(0, 20).map(a => (
                                                <button key={a.id} type="button" onClick={() => selectAsset(a)} className="w-full text-left p-3 hover:bg-slate-50 border-b border-slate-100 text-sm">
                                                    <span className="font-mono text-xs text-blue-600">{a.code}</span>
                                                    <span className="ml-2">{a.name}</span>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Location (if NON_ASSET) */}
                {type === 'NON_ASSET' && (
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
