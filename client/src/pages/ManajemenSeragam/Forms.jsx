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
    const [selectedItem, setSelectedItem] = useState('');
    const [itemSearch, setItemSearch] = useState('');
    const [items, setItems] = useState(initialItems || []);

    const getItemLabel = (item) => {
        if (!item) return '';
        return `${item.category?.name || ''} ${item.gender || ''} ${item.unit?.name || ''}`.trim();
    };

    const addItem = () => {
        if (!selectedItem) return;
        const item = items.find(i => String(i.id) === String(selectedItem));
        if (!item || form.items?.some(fi => fi.itemId === item.id)) return;
        setForm({ ...form, items: [...(form.items || []), { itemId: item.id, itemName: getItemLabel(item), qty: 1 }] });
        setSelectedItem('');
        setItemSearch('');
    };

    return (
        <div className="space-y-4">
            <InputField label="Nama Paket" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Paket Siswa Baru SMP Putra" required />
            <div className="grid grid-cols-3 gap-4">
                <SelectField label="Jenjang / Unit" value={form.targetUnit || ''} onChange={e => setForm({ ...form, targetUnit: e.target.value })}>
                    <option value="">Semua</option>
                    {units?.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                </SelectField>
                <SelectField label="Gender" value={form.gender || ''} onChange={e => setForm({ ...form, gender: e.target.value })}>
                    <option value="">Semua</option>
                    <option value="IKHWAN">Ikhwan</option><option value="AKHWAT">Akhwat</option>
                </SelectField>
                <InputField label="Harga Paket (Rp)" type="number" value={form.price || ''} onChange={e => setForm({ ...form, price: e.target.value })} />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Isi Paket</label>
                {(form.items || []).map((fi, idx) => (
                    <div key={idx} className="flex items-center gap-2 mb-1.5 bg-slate-50 p-2 rounded-lg">
                        <span className="flex-1 text-sm font-medium">{fi.itemName || items.find(i => i.id === fi.itemId)?.name}</span>
                        <input type="number" min="1" className="w-16 border rounded-lg px-2 py-1 text-sm text-center" value={fi.qty} onChange={e => { const newItems = [...form.items]; newItems[idx].qty = parseInt(e.target.value) || 1; setForm({ ...form, items: newItems }); }} />
                        <button onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })} className="text-red-400 hover:text-red-600"><X size={14} /></button>
                    </div>
                ))}
                <div className="flex gap-2 mt-2">
                    <input 
                        list="pkg-variants-list" 
                        value={itemSearch} 
                        onChange={(e) => {
                            const val = e.target.value;
                            const match = items.find(v => getItemLabel(v) === val);
                            setItemSearch(val);
                            setSelectedItem(match ? match.id : '');
                        }} 
                        placeholder="Ketik untuk mencari Barang..." 
                        className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white" 
                    />
                    <datalist id="pkg-variants-list">
                        {items.map(v => (
                            <option key={v.id} value={getItemLabel(v)} />
                        ))}
                    </datalist>
                    <button onClick={addItem} className="px-3 py-2 bg-slate-100 rounded-xl hover:bg-slate-200"><Plus size={14} /></button>
                </div>
            </div>
            <button onClick={() => onSave(form)} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20">Simpan Paket</button>
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
