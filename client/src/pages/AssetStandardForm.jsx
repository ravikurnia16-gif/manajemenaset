import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FileText, ArrowLeft, Save, Image as ImageIcon, X, AlertCircle } from 'lucide-react';
import api from '../lib/axios';

const AssetStandardForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState([]);
    const [preview, setPreview] = useState(null);
    const [error, setError] = useState('');

    const [form, setForm] = useState({
        name: '',
        categoryId: '',
        specification: '',
        minSpec: '',
        estimatedPrice: '',
        note: '',
        image: null
    });

    useEffect(() => {
        const fetchMeta = async () => {
            try {
                const res = await api.get('/master/categories');
                setCategories(res.data);
                if (id) {
                    const std = await api.get(`/asset-standards/${id}`);
                    const d = std.data;
                    setForm({
                        name: d.name,
                        categoryId: d.categoryId,
                        specification: d.specification || '',
                        minSpec: d.minSpec || '',
                        estimatedPrice: d.estimatedPrice || '',
                        note: d.note || '',
                        image: d.image
                    });
                    if (d.image) setPreview(d.image.startsWith('http') ? d.image : `${import.meta.env.VITE_API_URL}/uploads/${d.image}`);
                }
            } catch (e) { console.error(e); }
        };
        fetchMeta();
    }, [id]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleFile = (e) => {
        const file = e.target.files[0];
        if (file) {
            setForm(prev => ({ ...prev, image: file }));
            setPreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const formData = new FormData();
        Object.keys(form).forEach(key => {
            if (form[key] !== null && form[key] !== undefined) {
                formData.append(key, form[key]);
            }
        });

        try {
            if (id) {
                await api.put(`/asset-standards/${id}`, formData);
            } else {
                await api.post('/asset-standards', formData);
            }
            navigate('/aset/katalog-standar');
        } catch (err) {
            setError(err.response?.data?.error || 'Gagal menyimpan standar');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-8 min-h-screen bg-slate-50 flex justify-center">
            <div className="w-full max-w-4xl space-y-8">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 bg-white rounded-xl shadow-sm border border-slate-200 text-slate-500 hover:text-indigo-600 transition-all">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900">{id ? 'Edit' : 'Tambah'} Standar Aset</h1>
                        <p className="text-sm text-slate-500">Tentukan spesifikasi resmi untuk katalog sarpras</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Left Column: Details */}
                    <div className="md:col-span-2 space-y-6">
                        <div className="bg-white rounded-[32px] border border-slate-200 p-8 shadow-sm space-y-6">
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Nama Barang / Model</label>
                                        <input
                                            required
                                            name="name"
                                            value={form.name}
                                            onChange={handleChange}
                                            placeholder="Contoh: Laptop Admin TU"
                                            className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Kategori Aset</label>
                                        <select
                                            required
                                            name="categoryId"
                                            value={form.categoryId}
                                            onChange={handleChange}
                                            className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all font-medium"
                                        >
                                            <option value="">Pilih Kategori</option>
                                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Spesifikasi Lengkap</label>
                                    <textarea
                                        rows={6}
                                        name="specification"
                                        value={form.specification}
                                        onChange={handleChange}
                                        placeholder="Tuliskan detail spesifikasi teknis di sini..."
                                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all resize-none italic"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Spesifikasi Minimum (Singkat)</label>
                                        <input
                                            name="minSpec"
                                            value={form.minSpec}
                                            onChange={handleChange}
                                            placeholder="i3, 8GB RAM, SSD 256GB"
                                            className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Estimasi Harga Satuan</label>
                                        <div className="relative">
                                            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">Rp</span>
                                            <input
                                                type="number"
                                                name="estimatedPrice"
                                                value={form.estimatedPrice}
                                                onChange={handleChange}
                                                placeholder="0"
                                                className="w-full pl-12 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all font-bold text-emerald-600"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-[32px] border border-slate-200 p-8 shadow-sm space-y-4">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Catatan Tambahan</label>
                            <textarea
                                rows={3}
                                name="note"
                                value={form.note}
                                onChange={handleChange}
                                placeholder="Ketentuan khusus, garansi, atau merk yang direkomendasikan..."
                                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all resize-none"
                            />
                        </div>
                    </div>

                    {/* Right Column: Image & Actions */}
                    <div className="space-y-6">
                        <div className="bg-white rounded-[32px] border border-slate-200 p-8 shadow-sm space-y-6 text-center">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest block text-left mb-2">Foto Referensi Model</label>
                            
                            <div className="relative group w-full aspect-square bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 overflow-hidden flex flex-col items-center justify-center transition-all hover:border-indigo-300">
                                {preview ? (
                                    <>
                                        <img src={preview} className="w-full h-full object-cover" alt="Preview" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                            <label className="p-3 bg-white rounded-xl cursor-pointer hover:scale-110 transition-transform"><ImageIcon size={20} className="text-indigo-600" /><input type="file" className="hidden" onChange={handleFile} accept="image/*" /></label>
                                            <button type="button" onClick={() => {setPreview(null); setForm(p=>({...p, image:null}))}} className="p-3 bg-white rounded-xl hover:scale-110 transition-transform"><X size={20} className="text-red-600" /></button>
                                        </div>
                                    </>
                                ) : (
                                    <label className="cursor-pointer space-y-3 flex flex-col items-center">
                                        <div className="p-4 bg-white rounded-2xl shadow-sm text-slate-300"><ImageIcon size={32} /></div>
                                        <div className="text-xs text-slate-400 font-bold">Klik untuk upload foto</div>
                                        <input type="file" className="hidden" onChange={handleFile} accept="image/*" />
                                    </label>
                                )}
                            </div>
                        </div>

                        {error && (
                            <div className="p-4 bg-red-50 rounded-2xl border border-red-100 flex items-start gap-3 animate-shake">
                                <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
                                <p className="text-xs text-red-600 font-medium leading-relaxed">{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-3 bg-indigo-600 text-white py-4 rounded-[28px] font-black shadow-xl shadow-indigo-100 hover:shadow-indigo-200 hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-50 disabled:translate-y-0"
                        >
                            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Save size={20} />}
                            {id ? 'Simpan Perubahan' : 'Terbitkan Standar'}
                        </button>

                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            className="w-full py-4 rounded-[28px] text-slate-400 font-bold hover:text-slate-600 transition-colors"
                        >
                            Batalkan
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AssetStandardForm;
