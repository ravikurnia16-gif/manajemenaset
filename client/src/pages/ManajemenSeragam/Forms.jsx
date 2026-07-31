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

    // State for the new fields (used when creating a new package)
    const [kategori, setKategori] = useState('');
    const [gender, setGender] = useState('');
    const [unit, setUnit] = useState('');
    const [harga, setHarga] = useState(initialData?.price || '');

    const handleSave = () => {
        let packageData = { ...form, price: parseFloat(harga) || 0 };
        
        if (!initialData) {
            const displayGender = gender === 'IKHWAN' ? 'Ikhwan' : gender === 'AKHWAT' ? 'Akhwat' : gender;
            const generatedName = `${kategori} ${displayGender} ${unit}`.trim();
            
            const matchingItems = items.filter(i => 
                i.category?.name === kategori && 
                i.gender === gender && 
                i.unit?.name === unit
            );

            packageData = {
                ...packageData,
                name: generatedName,
                targetUnit: unit,
                gender: gender,
                items: matchingItems.map(i => ({ itemId: i.id, qty: 1 }))
            };
        }
        
        onSave(packageData);
    };

    return (
        <div className="space-y-4">
            {!initialData && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            )}
            {initialData && (
                <InputField label="Nama Paket" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} required />
            )}
            <InputField label="Harga Paket (Rp)" type="number" value={harga} onChange={e => setHarga(e.target.value)} required />
            
            <button 
                onClick={handleSave} 
                disabled={!initialData && (!kategori || !gender || !unit || harga === '')} 
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 disabled:opacity-50"
            >
                Simpan Paket
            </button>
        </div>
    );
};
export const ManualStockForm = ({ categories = [], clothingTypes = [], units = [], sizes = [], warehouses = [], vendors = [], onSave }) => {
    const [form, setForm] = useState({
        kategori: '',
        jenisPakaian: '',
        unit: '',
        gender: '',
        ukuran: '',
        gudang: '',
        vendor: '',
        stok: 0,
        stokMinimal: 3
    });

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <SelectField label="Kategori *" name="kategori" value={form.kategori} onChange={handleChange} required>
                    <option value="">Pilih Kategori</option>
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </SelectField>
                <SelectField label="Jenis Pakaian *" name="jenisPakaian" value={form.jenisPakaian} onChange={handleChange} required>
                    <option value="">Pilih Jenis Pakaian</option>
                    {clothingTypes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </SelectField>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
                <SelectField label="Unit *" name="unit" value={form.unit} onChange={handleChange} required>
                    <option value="">Pilih Unit</option>
                    {units.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                </SelectField>
                <SelectField label="Gender *" name="gender" value={form.gender} onChange={handleChange} required>
                    <option value="">Pilih Gender</option>
                    <option value="IKHWAN">Ikhwan</option>
                    <option value="AKHWAT">Akhwat</option>
                </SelectField>
                <SelectField label="Ukuran *" name="ukuran" value={form.ukuran} onChange={handleChange} required>
                    <option value="">Pilih Ukuran</option>
                    {sizes.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </SelectField>
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

            <button onClick={() => onSave(form)} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 mt-4">
                Simpan Stok
            </button>
        </div>
    );
};
