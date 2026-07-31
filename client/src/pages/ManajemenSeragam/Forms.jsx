import { useState, useEffect } from 'react';
import { Plus, X, FileSpreadsheet } from 'lucide-react';
import api from '../../lib/axios';
import { InputField, SelectField } from './UIComponents';

export const SimpleForm = ({ fields, initialData, onSave }) => {
    const [form, setForm] = useState(initialData || {});
    return (
        <div className="space-y-4">
            {fields.map(f => (
                <InputField key={f.name} label={f.label} value={form[f.name] || ''} onChange={e => setForm({ ...form, [f.name]: e.target.value })} placeholder={f.placeholder} required={f.required} />
            ))}
            <button onClick={() => onSave(form)} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 transition-all">Simpan</button>
        </div>
    );
};


export const TransactionForm = ({ variants = [], warehouses = [], vendors = [], onSave }) => {
    const [form, setForm] = useState({ type: 'IN', quantity: 1, costPerUnit: 0, variantId: '', variantSearch: '' });

    return (
        <div className="space-y-4">
            <SelectField label="Tipe Transaksi" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                <option value="IN">Barang Masuk (IN)</option>
                <option value="OUT">Barang Keluar (OUT)</option>
                <option value="MUTATION">Mutasi Antar Gudang</option>
                <option value="ADJUSTMENT">Penyesuaian Stok</option>
            </SelectField>
            
            <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pilih Barang (Variant) *</label>
                <input 
                    list="trx-variants-list" 
                    value={form.variantSearch || ''} 
                    onChange={(e) => {
                        const val = e.target.value;
                        const match = variants.find(v => `${v.sku} - ${v.item?.name} (${v.sizeName})` === val);
                        setForm({ ...form, variantSearch: val, variantId: match ? match.id : '' });
                    }} 
                    placeholder="Ketik untuk mencari SKU atau Nama Barang..." 
                    className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all w-full" 
                    required 
                />
                <datalist id="trx-variants-list">
                    {variants.map(v => (
                        <option key={v.id} value={`${v.sku} - ${v.item?.name} (${v.sizeName})`} />
                    ))}
                </datalist>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <SelectField label="Gudang Asal" value={form.warehouseId || ''} onChange={e => setForm({ ...form, warehouseId: e.target.value })}>
                    <option value="">Pilih Gudang</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </SelectField>
                {form.type === 'MUTATION' && (
                    <SelectField label="Gudang Tujuan" value={form.toWarehouseId || ''} onChange={e => setForm({ ...form, toWarehouseId: e.target.value })}>
                        <option value="">Pilih Gudang Tujuan</option>
                        {warehouses.filter(w => String(w.id) !== String(form.warehouseId)).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </SelectField>
                )}
            </div>
            <div className="grid grid-cols-2 gap-4">
                <InputField label="Jumlah" type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
                {form.type === 'IN' && (
                    <InputField label="Harga Beli per Unit (Rp)" type="number" value={form.costPerUnit} onChange={e => setForm({ ...form, costPerUnit: e.target.value })} />
                )}
            </div>
            {form.type === 'IN' && (
                <SelectField label="Vendor (Opsional)" value={form.vendorId || ''} onChange={e => setForm({ ...form, vendorId: e.target.value })}>
                    <option value="">Tanpa Vendor</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </SelectField>
            )}
            {form.type === 'ADJUSTMENT' && (
                <InputField label="Alasan Penyesuaian *" value={form.reason || ''} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Contoh: Cacat dari vendor, Dimakan tikus, Hilang" required />
            )}
            <InputField label="Catatan" value={form.note || ''} onChange={e => setForm({ ...form, note: e.target.value })} />
            <button onClick={() => onSave(form)} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20">Simpan Transaksi</button>
        </div>
    );
};

export const PackageForm = ({ items: initialItems, units, initialData, onSave }) => {
    const [form, setForm] = useState(initialData || { isFixedPrice: true, items: [] });
    const items = initialItems || [];
    
    // Derive unique categories from items
    const categories = Array.from(new Set(items.map(i => i.category?.name))).filter(Boolean);

    // State for the new combination fields
    const [kategori, setKategori] = useState('');
    const [gender, setGender] = useState('');
    const [unit, setUnit] = useState('');

    const addCombination = () => {
        if (!kategori || !gender || !unit) return;

        const matchingItems = items.filter(i => 
            i.category?.name === kategori && 
            i.gender === gender && 
            i.unit?.name === unit
        );

        const newItems = matchingItems
            .filter(i => !form.items?.some(fi => fi.itemId === i.id))
            .map(i => ({ 
                itemId: i.id, 
                itemName: `${i.category?.name || ''} ${i.gender || ''} ${i.unit?.name || ''} ${i.clothingType?.name || ''}`.trim(), 
                qty: 1 
            }));

        if (newItems.length > 0) {
            setForm({ ...form, items: [...(form.items || []), ...newItems] });
        }
        
        // Reset selections
        setKategori('');
        setGender('');
        setUnit('');
    };

    const handleSave = () => {
        onSave({
            ...form,
            price: parseFloat(form.price) || 0,
            targetUnit: form.targetUnit || 'ALL', // default fallback
            gender: form.gender || 'ALL', // default fallback
        });
    };

    return (
        <div className="space-y-4">
            <InputField label="Nama Paket" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Contoh: Paket SD" required />
            <InputField label="Harga Paket (Rp)" type="number" value={form.price || ''} onChange={e => setForm({ ...form, price: e.target.value })} required />
            
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                <label className="block text-xs font-bold text-slate-500 uppercase">Tambah Isi Paket (Berdasarkan Kategori)</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <SelectField label="Kategori" value={kategori} onChange={e => setKategori(e.target.value)}>
                        <option value="">Pilih Kategori</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </SelectField>
                    <SelectField label="Gender" value={gender} onChange={e => setGender(e.target.value)}>
                        <option value="">Pilih Gender</option>
                        <option value="IKHWAN">Ikhwan</option>
                        <option value="AKHWAT">Akhwat</option>
                    </SelectField>
                    <SelectField label="Jenjang / Unit" value={unit} onChange={e => setUnit(e.target.value)}>
                        <option value="">Pilih Unit</option>
                        {units?.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                    </SelectField>
                </div>
                <button 
                    onClick={addCombination}
                    disabled={!kategori || !gender || !unit}
                    className="w-full bg-slate-200 text-slate-700 py-2 rounded-lg text-sm font-bold hover:bg-slate-300 transition disabled:opacity-50"
                >
                    Tambah Kombinasi ke Paket
                </button>
            </div>

            {form.items?.length > 0 && (
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Daftar Isi Paket</label>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-2">
                        {form.items.map((fi, idx) => {
                            const actualItem = items.find(i => i.id === fi.itemId);
                            const displayName = fi.itemName || `${actualItem?.category?.name || ''} ${actualItem?.gender || ''} ${actualItem?.unit?.name || ''} ${actualItem?.clothingType?.name || ''}`.trim();
                            return (
                                <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    <span className="flex-1 text-sm font-medium text-slate-700">{displayName}</span>
                                    <button onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })} className="text-red-400 hover:text-red-600 p-1">
                                        <X size={14} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <button 
                onClick={handleSave} 
                disabled={!form.name || form.price === '' || form.items?.length === 0} 
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 disabled:opacity-50 mt-4"
            >
                Simpan Paket
            </button>
        </div>
    );
};
export const ManualStockForm = ({ variants = [], warehouses = [], vendors = [], onSave }) => {
    const [form, setForm] = useState({ variantId: '', gudang: '', vendor: '', stok: 0, stokMinimal: 3 });
    const [kategori, setKategori] = useState('');
    const [jenisPakaian, setJenisPakaian] = useState('');
    const [unit, setUnit] = useState('');
    const [gender, setGender] = useState('');
    const [ukuran, setUkuran] = useState('');

    const availableCategories = Array.from(new Set(variants.map(v => v.item?.category?.name))).filter(Boolean);
    
    const availableJenis = Array.from(new Set(
        variants.filter(v => v.item?.category?.name === kategori)
        .map(v => v.item?.clothingType?.name)
    )).filter(Boolean);

    const availableUnits = Array.from(new Set(
        variants.filter(v => v.item?.category?.name === kategori && v.item?.clothingType?.name === jenisPakaian)
        .map(v => v.item?.unit?.name)
    )).filter(Boolean);

    const availableGenders = Array.from(new Set(
        variants.filter(v => v.item?.category?.name === kategori && v.item?.clothingType?.name === jenisPakaian && v.item?.unit?.name === unit)
        .map(v => v.item?.gender)
    )).filter(Boolean);

    const availableSizes = Array.from(new Set(
        variants.filter(v => v.item?.category?.name === kategori && v.item?.clothingType?.name === jenisPakaian && v.item?.unit?.name === unit && v.item?.gender === gender)
        .map(v => v.sizeName)
    )).filter(Boolean);

    useEffect(() => {
        if (kategori && jenisPakaian && unit && gender && ukuran) {
            const match = variants.find(v => 
                v.item?.category?.name === kategori && 
                v.item?.clothingType?.name === jenisPakaian && 
                v.item?.unit?.name === unit && 
                v.item?.gender === gender && 
                v.sizeName === ukuran
            );
            if (match) setForm(f => ({ ...f, variantId: match.id }));
            else setForm(f => ({ ...f, variantId: '' }));
        } else {
            setForm(f => ({ ...f, variantId: '' }));
        }
    }, [kategori, jenisPakaian, unit, gender, ukuran, variants]);

    // Handle cascading resets
    const handleKategoriChange = (e) => { setKategori(e.target.value); setJenisPakaian(''); setUnit(''); setGender(''); setUkuran(''); };
    const handleJenisChange = (e) => { setJenisPakaian(e.target.value); setUnit(''); setGender(''); setUkuran(''); };
    const handleUnitChange = (e) => { setUnit(e.target.value); setGender(''); setUkuran(''); };
    const handleGenderChange = (e) => { setGender(e.target.value); setUkuran(''); };
    const handleUkuranChange = (e) => { setUkuran(e.target.value); };
    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    return (
        <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4 space-y-4">
                <div className="text-xs font-bold text-slate-500 uppercase">Pilih Barang (Berdasarkan Data Master)</div>
                <div className="grid grid-cols-2 gap-4">
                    <SelectField label="Kategori *" value={kategori} onChange={handleKategoriChange} required>
                        <option value="">Pilih Kategori</option>
                        {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </SelectField>
                    <SelectField label="Jenis Pakaian *" value={jenisPakaian} onChange={handleJenisChange} disabled={!kategori} required>
                        <option value="">Pilih Jenis Pakaian</option>
                        {availableJenis.map(c => <option key={c} value={c}>{c}</option>)}
                    </SelectField>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                    <SelectField label="Unit *" value={unit} onChange={handleUnitChange} disabled={!jenisPakaian} required>
                        <option value="">Pilih Unit</option>
                        {availableUnits.map(u => <option key={u} value={u}>{u}</option>)}
                    </SelectField>
                    <SelectField label="Gender *" value={gender} onChange={handleGenderChange} disabled={!unit} required>
                        <option value="">Pilih Gender</option>
                        {availableGenders.map(g => <option key={g} value={g}>{g === 'IKHWAN' ? 'Ikhwan' : 'Akhwat'}</option>)}
                    </SelectField>
                    <SelectField label="Ukuran *" value={ukuran} onChange={handleUkuranChange} disabled={!gender} required>
                        <option value="">Pilih Ukuran</option>
                        {availableSizes.map(s => <option key={s} value={s}>{s}</option>)}
                    </SelectField>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <SelectField label="Lokasi Gudang *" name="gudang" value={form.gudang} onChange={handleChange} required>
                    <option value="">Pilih Gudang</option>
                    {warehouses.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
                </SelectField>
                <SelectField label="Vendor" name="vendor" value={form.vendor} onChange={handleChange}>
                    <option value="">Tanpa Vendor (Opsional)</option>
                    {vendors.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                </SelectField>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <InputField label="Stok *" type="number" name="stok" value={form.stok} onChange={handleChange} required />
                <InputField label="Stok Minimal" type="number" name="stokMinimal" value={form.stokMinimal} onChange={handleChange} />
            </div>

            <button 
                onClick={() => onSave(form)} 
                disabled={!form.variantId || !form.gudang || !form.stok}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 mt-4 disabled:opacity-50"
            >
                Simpan Stok
            </button>
        </div>
    );
};
