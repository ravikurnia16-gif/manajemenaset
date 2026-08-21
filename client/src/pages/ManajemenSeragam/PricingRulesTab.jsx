import { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle2, Play } from 'lucide-react';
import api from '../../lib/axios';
import { SelectField, InputField } from './UIComponents';

export const PricingRulesTab = ({ categories, clothingTypes, units, sizes }) => {
    const [rules, setRules] = useState([]);
    const [variants, setVariants] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);

    const [form, setForm] = useState({
        categoryId: '',
        clothingTypeId: '',
        unitId: '',
        gender: '',
        sizeNames: [],
        price: ''
    });

    const fetchRules = async () => {
        setLoading(true);
        try {
            const res = await api.get('/uniforms/pricing-rules');
            setRules(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRules();
        api.get('/uniforms/variants').then(res => setVariants(res.data)).catch(console.error);
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/uniforms/pricing-rules', {
                ...form,
                sizeNames: form.sizeNames.length > 0 ? form.sizeNames.join(';') : ''
            });
            setShowForm(false);
            setForm({ categoryId: '', clothingTypeId: '', unitId: '', gender: '', sizeNames: [], price: '' });
            fetchRules();
        } catch (error) {
            alert(error.response?.data?.error || 'Gagal menyimpan aturan');
        }
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

        const validSizeNames = [...new Set(catVariants.map(v => v.sizeName || v.size?.name).filter(Boolean))];
        filteredSizes = sizes.filter(s => validSizeNames.includes(s.name));
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Aturan Harga Otomatis</h2>
                    <p className="text-sm text-slate-500">Buat aturan untuk men-set harga jual seragam secara otomatis berdasarkan kriteria tertentu.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={applyRules} className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-green-500/20 hover:from-green-700 hover:to-emerald-700 transition-all">
                        <Play size={16} /> Terapkan ke Semua Barang
                    </button>
                    <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all">
                        <Plus size={16} /> {showForm ? 'Batal' : 'Tambah Aturan'}
                    </button>
                </div>
            </div>

            {showForm && (
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                    <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-2">Buat Aturan Baru</h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <SelectField label="Kategori" value={form.categoryId} onChange={e => setForm({...form, categoryId: e.target.value})}>
                                <option value="">Semua Kategori</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </SelectField>
                            <SelectField label="Jenis Pakaian" value={form.clothingTypeId} onChange={e => setForm({...form, clothingTypeId: e.target.value})}>
                                <option value="">Semua Jenis Pakaian</option>
                                {filteredClothingTypes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </SelectField>
                            <SelectField label="Unit / Jenjang" value={form.unitId} onChange={e => setForm({...form, unitId: e.target.value})}>
                                <option value="">Semua Unit</option>
                                {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </SelectField>
                            <SelectField label="Gender" value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}>
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
                                            className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${isSelected ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50'}`}
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
                                <InputField label="Harga Jual (Rp) *" type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})} required />
                            </div>
                            <button type="submit" className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all">
                                Simpan Aturan
                            </button>
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
                                <th className="px-6 py-4 font-bold text-right">Harga Jual (Rp)</th>
                                <th className="px-6 py-4 font-bold w-20 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading && <tr><td colSpan="3" className="text-center py-8 text-slate-400">Loading...</td></tr>}
                            {!loading && rules.length === 0 && <tr><td colSpan="3" className="text-center py-8 text-slate-400">Belum ada aturan harga yang dibuat.</td></tr>}
                            
                            {!loading && rules.map(rule => (
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
                                        <button onClick={() => handleDelete(rule.id)} className="text-slate-400 hover:text-red-500 transition-colors p-2 bg-white rounded-lg shadow-sm border border-slate-100">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
