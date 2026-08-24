import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Play, Edit2, History, X, CheckCircle2, Download, Upload, Loader2 } from 'lucide-react';
import api from '../../lib/axios';
import { SelectField, InputField } from './UIComponents';

export const PricingRulesTab = ({ categories, clothingTypes, units, sizes }) => {
    const [rules, setRules] = useState([]);
    const [variants, setVariants] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingRuleId, setEditingRuleId] = useState(null);
    const [historyRule, setHistoryRule] = useState(null); // Aturan yang sedang dilihat riwayatnya
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef(null);

    const [form, setForm] = useState({
        categoryId: '',
        clothingTypeId: '',
        unitId: '',
        gender: '',
        sizeNames: [],
        price: ''
    });

    const [namaDadaPrice, setNamaDadaPrice] = useState(15000);
    const [isSavingNd, setIsSavingNd] = useState(false);

    const fetchRules = async () => {
        setLoading(true);
        try {
            const res = await api.get('/uniforms/pricing-rules');
            setRules(res.data);
            const ndRes = await api.get('/uniforms/nama-dada-price').catch(() => ({ data: { price: 15000 } }));
            if (ndRes && ndRes.data) setNamaDadaPrice(ndRes.data.price);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadTemplate = async () => {
        try {
            const res = await api.get('/uniforms/pricing-rules/template', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'Template_Import_Aturan_Harga.xlsx');
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (err) {
            alert('Gagal mendownload template aturan harga');
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        setIsImporting(true);
        try {
            const res = await api.post('/uniforms/pricing-rules/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert(res.data.message || 'Import berhasil!');
            fetchRules();
        } catch (error) {
            alert(error.response?.data?.error || 'Gagal mengimpor data aturan harga');
        } finally {
            setIsImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    useEffect(() => {
        fetchRules();
        api.get('/uniforms/variants').then(res => setVariants(res.data)).catch(console.error);
    }, []);

    const saveNamaDadaPrice = async () => {
        if (!confirm('Simpan harga baru untuk Nama Dada?')) return;
        setIsSavingNd(true);
        try {
            await api.put('/uniforms/nama-dada-price', { price: namaDadaPrice });
            alert('Harga Nama Dada berhasil diperbarui!');
        } catch (error) {
            alert('Gagal menyimpan harga Nama Dada');
        } finally {
            setIsSavingNd(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...form,
                sizeNames: form.sizeNames.length > 0 ? form.sizeNames.join(';') : ''
            };

            if (editingRuleId) {
                await api.put(`/uniforms/pricing-rules/${editingRuleId}`, { price: form.price });
            } else {
                await api.post('/uniforms/pricing-rules', payload);
            }
            
            setShowForm(false);
            setEditingRuleId(null);
            setForm({ categoryId: '', clothingTypeId: '', unitId: '', gender: '', sizeNames: [], price: '' });
            fetchRules();
        } catch (error) {
            alert(error.response?.data?.error || 'Gagal menyimpan aturan');
        }
    };

    const handleEdit = (rule) => {
        setForm({
            categoryId: rule.categoryId || '',
            clothingTypeId: rule.clothingTypeId || '',
            unitId: rule.unitId || '',
            gender: rule.gender || '',
            sizeNames: rule.sizeNames ? rule.sizeNames.split(';') : [],
            price: rule.price || ''
        });
        setEditingRuleId(rule.id);
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (!confirm('Hapus aturan ini?')) return;
        try {
            await api.delete(`/uniforms/pricing-rules/${id}`);
            fetchRules();
        } catch (error) {
            alert('Gagal menghapus');
        }
    };

    const applyRules = async () => {
        if (!confirm('Apakah Anda yakin ingin menerapkan aturan harga ini ke semua barang? Aksi ini akan menimpa harga varian barang yang sesuai kriteria.')) return;
        try {
            const res = await api.post('/uniforms/pricing-rules/apply');
            alert(res.data.message);
        } catch (error) {
            alert('Gagal menerapkan aturan harga.');
        }
    };

    const toggleSize = (sizeName) => {
        setForm(prev => {
            const current = [...prev.sizeNames];
            if (current.includes(sizeName)) return { ...prev, sizeNames: current.filter(s => s !== sizeName) };
            return { ...prev, sizeNames: [...current, sizeName] };
        });
    };

    // Filter Options dynamically based on Category
    let filteredClothingTypes = clothingTypes;
    let filteredGenders = ['IKHWAN', 'AKHWAT'];
    let filteredSizes = sizes;

    if (form.categoryId) {
        const catVariants = variants.filter(v => v.item?.categoryId === parseInt(form.categoryId));
        
        const validClothingTypeIds = [...new Set(catVariants.map(v => v.item?.clothingTypeId).filter(Boolean))];
        filteredClothingTypes = clothingTypes.filter(c => validClothingTypeIds.includes(c.id));

        const validGenders = [...new Set(catVariants.map(v => v.item?.gender).filter(Boolean))];
        filteredGenders = validGenders;
    }

    let matchingVariants = variants;
    if (form.categoryId) matchingVariants = matchingVariants.filter(v => v.item?.categoryId === parseInt(form.categoryId));
    if (form.clothingTypeId) matchingVariants = matchingVariants.filter(v => v.item?.clothingTypeId === parseInt(form.clothingTypeId));
    if (form.gender) matchingVariants = matchingVariants.filter(v => v.item?.gender === form.gender);
    if (form.unitId) matchingVariants = matchingVariants.filter(v => v.item?.unitId === parseInt(form.unitId));

    if (form.categoryId || form.clothingTypeId || form.gender || form.unitId) {
        const validSizeNames = [...new Set(matchingVariants.map(v => v.sizeName || v.size?.name).filter(Boolean))];
        filteredSizes = sizes.filter(s => validSizeNames.includes(s.name));
    }

    const activeRules = rules.filter(r => r.isActive !== false);
    
    // Fungsi untuk mendapatkan riwayat dari suatu aturan
    const getHistoryForRule = (rule) => {
        if (!rule) return [];
        return rules.filter(r => 
            r.isActive === false &&
            (r.categoryId ?? null) === (rule.categoryId ?? null) &&
            (r.clothingTypeId ?? null) === (rule.clothingTypeId ?? null) &&
            (r.unitId ?? null) === (rule.unitId ?? null) &&
            (r.gender ?? null) === (rule.gender ?? null) &&
            (r.sizeNames ?? null) === (rule.sizeNames ?? null)
        ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    };

    return (
        <div className="space-y-6 relative">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Aturan Harga Otomatis</h2>
                    <p className="text-sm text-slate-500">Buat aturan untuk men-set harga jual seragam secara otomatis berdasarkan kriteria tertentu.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                    
                    <button onClick={handleDownloadTemplate} className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold hover:bg-slate-50 transition-all shadow-sm" title="Download Template Excel">
                        <Download size={16} className="text-blue-600" /> Template Excel
                    </button>
                    
                    <button onClick={() => fileInputRef.current?.click()} disabled={isImporting} className="flex items-center gap-1.5 bg-emerald-600 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all disabled:opacity-50" title="Import Aturan Harga dari Excel">
                        {isImporting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} {isImporting ? 'Mengimpor...' : 'Import Excel'}
                    </button>

                    <button onClick={applyRules} className="flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 transition-all" title="Terapkan semua aturan harga aktif ke varian seragam">
                        <Play size={16} /> Terapkan ke Stok
                    </button>

                    <button onClick={() => {
                        setEditingRuleId(null);
                        setForm({ categoryId: '', clothingTypeId: '', unitId: '', gender: '', sizeNames: [], price: '' });
                        setShowForm(!showForm);
                    }} className="flex items-center gap-1.5 bg-slate-900 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-lg hover:bg-slate-800 transition-all">
                        <Plus size={16} /> {showForm && !editingRuleId ? 'Batal' : 'Tambah Aturan'}
                    </button>
                </div>
            </div>

            {/* Pengaturan Harga Tambahan */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-2">Pengaturan Harga Tambahan (Opsional)</h3>
                <div className="flex items-end gap-4 max-w-lg">
                    <div className="flex-1">
                        <InputField 
                            label="Harga Nama Dada (Bordir)" 
                            type="number" 
                            value={namaDadaPrice} 
                            onChange={e => setNamaDadaPrice(e.target.value)} 
                        />
                    </div>
                    <button 
                        onClick={saveNamaDadaPrice} 
                        disabled={isSavingNd}
                        className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50"
                    >
                        {isSavingNd ? 'Menyimpan...' : 'Simpan Harga'}
                    </button>
                    {getHistoryForRule({ gender: 'NAMADADA', categoryId: null, clothingTypeId: null, unitId: null, sizeNames: null }).length > 0 && (
                        <button 
                            onClick={() => setHistoryRule({ 
                                gender: 'NAMADADA', categoryId: null, clothingTypeId: null, unitId: null, sizeNames: null,
                                price: namaDadaPrice,
                                isNamaDada: true // Flag khusus agar modal riwayat tahu ini Nama Dada
                            })} 
                            className="bg-slate-100 text-slate-600 px-4 py-2.5 rounded-xl font-bold hover:bg-slate-200 transition-all flex items-center gap-2"
                        >
                            <History size={16} /> Riwayat
                        </button>
                    )}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">*Harga Nama Dada digunakan saat pembuatan pesanan baru secara terpisah, tidak diterapkan ke barang stok.</p>
            </div>

            {showForm && (
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                    <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-2">
                        {editingRuleId ? 'Update Harga Aturan' : 'Buat Aturan Baru'}
                    </h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <SelectField label="Kategori" value={form.categoryId} onChange={e => setForm({...form, categoryId: e.target.value})} disabled={!!editingRuleId}>
                                <option value="">Semua Kategori</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </SelectField>
                            <SelectField label="Jenis Pakaian" value={form.clothingTypeId} onChange={e => setForm({...form, clothingTypeId: e.target.value})} disabled={!!editingRuleId}>
                                <option value="">Semua Jenis Pakaian</option>
                                {filteredClothingTypes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </SelectField>
                            <SelectField label="Unit / Jenjang" value={form.unitId} onChange={e => setForm({...form, unitId: e.target.value})} disabled={!!editingRuleId}>
                                <option value="">Semua Unit</option>
                                {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </SelectField>
                            <SelectField label="Gender" value={form.gender} onChange={e => setForm({...form, gender: e.target.value})} disabled={!!editingRuleId}>
                                <option value="">Semua Gender</option>
                                {filteredGenders.map(g => <option key={g} value={g}>{g === 'IKHWAN' ? 'Ikhwan' : g === 'AKHWAT' ? 'Akhwat' : g}</option>)}
                            </SelectField>
                        </div>
                        
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Pilih Ukuran (Bisa lebih dari satu)</label>
                            <div className="flex flex-wrap gap-2">
                                {filteredSizes.map(s => {
                                    const isSelected = form.sizeNames.includes(s.name);
                                    return (
                                        <button 
                                            key={s.id} 
                                            type="button"
                                            onClick={() => toggleSize(s.name)}
                                            disabled={!!editingRuleId}
                                            className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${isSelected ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50'} ${editingRuleId ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            {s.name}
                                        </button>
                                    );
                                })}
                            </div>
                            {filteredSizes.length === 0 && form.categoryId && (
                                <p className="text-sm text-red-500 italic mt-1">Tidak ada ukuran yang tersedia untuk kategori ini di database.</p>
                            )}
                            <p className="text-[10px] text-slate-400 mt-1">*Jika tidak memilih ukuran satupun, maka berlaku untuk semua ukuran.</p>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex gap-4 items-end">
                            <div className="flex-1 max-w-xs">
                                <InputField label="Harga Jual Baru (Rp) *" type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})} required />
                            </div>
                            <button type="submit" className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all">
                                {editingRuleId ? 'Simpan Perubahan Harga' : 'Simpan Aturan'}
                            </button>
                            {editingRuleId && (
                                <button type="button" onClick={() => { setShowForm(false); setEditingRuleId(null); }} className="bg-slate-100 text-slate-600 px-6 py-2.5 rounded-xl font-bold hover:bg-slate-200 transition-all">
                                    Batal
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase text-xs">
                            <tr>
                                <th className="px-6 py-4 font-bold">Kondisi (Syarat)</th>
                                <th className="px-6 py-4 font-bold text-right">Harga Aktif (Rp)</th>
                                <th className="px-6 py-4 font-bold text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading && <tr><td colSpan="3" className="text-center py-8 text-slate-400">Loading...</td></tr>}
                            {!loading && activeRules.length === 0 && <tr><td colSpan="3" className="text-center py-8 text-slate-400">Belum ada aturan harga yang dibuat.</td></tr>}
                            
                            {!loading && activeRules.map(rule => {
                                const historyCount = getHistoryForRule(rule).length;
                                return (
                                    <tr key={rule.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-2">
                                                {rule.category && <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-xs border border-blue-100">Kategori: {rule.category.name}</span>}
                                                {rule.clothingType && <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded text-xs border border-indigo-100">Jenis: {rule.clothingType.name}</span>}
                                                {rule.unit && <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-xs border border-emerald-100">Unit: {rule.unit.name}</span>}
                                                {rule.gender && <span className="bg-purple-50 text-purple-600 px-2 py-0.5 rounded text-xs border border-purple-100">Gender: {rule.gender}</span>}
                                                {rule.sizeNames && <span className="bg-orange-50 text-orange-600 px-2 py-0.5 rounded text-xs border border-orange-100">Ukuran: {rule.sizeNames.replace(/;/g, ', ')}</span>}
                                                {!rule.categoryId && !rule.clothingTypeId && !rule.unitId && !rule.gender && !rule.sizeNames && (
                                                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs">Berlaku untuk Semua Barang</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-bold text-right text-slate-800">
                                            Rp {rule.price.toLocaleString('id-ID')}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                {historyCount > 0 && (
                                                    <button onClick={() => setHistoryRule(rule)} className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition-colors">
                                                        <History size={12} /> {historyCount} Riwayat
                                                    </button>
                                                )}
                                                <button onClick={() => handleEdit(rule)} className="text-blue-500 hover:text-blue-700 transition-colors p-1.5 bg-blue-50 rounded-lg shadow-sm border border-blue-100" title="Edit Harga">
                                                    <Edit2 size={14} />
                                                </button>
                                                <button onClick={() => handleDelete(rule.id)} className="text-red-400 hover:text-red-600 transition-colors p-1.5 bg-red-50 rounded-lg shadow-sm border border-red-100" title="Hapus Aturan">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Riwayat Harga */}
            {historyRule && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div className="flex items-center gap-3 text-slate-800">
                                <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                                    <History size={20} />
                                </div>
                                <h2 className="font-bold text-lg">{historyRule.isNamaDada ? 'Riwayat Harga Nama Dada' : 'Riwayat Harga'}</h2>
                            </div>
                            <button onClick={() => setHistoryRule(null)} className="text-slate-400 hover:bg-white hover:text-slate-600 p-2 rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-[60vh]">
                            <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                                
                                {/* Harga Aktif Sekarang */}
                                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-blue-100 text-blue-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                                        <CheckCircle2 size={16} />
                                    </div>
                                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-blue-200 bg-blue-50 shadow-sm">
                                        <div className="flex items-center justify-between space-x-2 mb-1">
                                            <div className="font-bold text-slate-800 text-sm">Harga Saat Ini</div>
                                            <time className="text-[10px] font-medium text-slate-500">Aktif</time>
                                        </div>
                                        <div className="text-blue-600 font-bold">
                                            Rp {Number(historyRule.price || 0).toLocaleString('id-ID')}
                                        </div>
                                    </div>
                                </div>

                                {/* Daftar Harga Lama */}
                                {getHistoryForRule(historyRule).map((hr, idx) => (
                                    <div key={hr.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-slate-100 text-slate-400 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                                            <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                                        </div>
                                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
                                            <div className="flex items-center justify-between space-x-2 mb-1">
                                                <div className="font-bold text-slate-700 text-sm">Riwayat ke-{getHistoryForRule(historyRule).length - idx}</div>
                                                <time className="text-[10px] font-medium text-slate-400">
                                                    Dibuat: {hr.createdAt ? new Date(hr.createdAt).toLocaleDateString('id-ID') : '-'}
                                                </time>
                                            </div>
                                            <div className="text-slate-600 font-bold line-through">
                                                Rp {Number(hr.price || 0).toLocaleString('id-ID')}
                                            </div>
                                            <div className="text-[10px] text-slate-400 mt-1">Status: Tidak Aktif</div>
                                        </div>
                                    </div>
                                ))}

                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
