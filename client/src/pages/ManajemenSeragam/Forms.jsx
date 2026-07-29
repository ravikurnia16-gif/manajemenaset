import { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
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

export const ItemForm = ({ categories, initialData, onSave }) => {
    const [form, setForm] = useState(initialData || { sizes: ['S', 'M', 'L', 'XL', 'XXL'] });
    const [sizeInput, setSizeInput] = useState('');

    const addSize = () => {
        if (sizeInput && !form.sizes?.includes(sizeInput.toUpperCase())) {
            setForm({ ...form, sizes: [...(form.sizes || []), sizeInput.toUpperCase()] });
            setSizeInput('');
        }
    };
    const removeSize = (s) => setForm({ ...form, sizes: form.sizes.filter(x => x !== s) });

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <InputField label="Nama Barang" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Kemeja Putih PDH" required />
                <SelectField label="Kategori" value={form.categoryId || ''} onChange={e => setForm({ ...form, categoryId: e.target.value })}>
                    <option value="">Pilih Kategori</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </SelectField>
            </div>
            <div className="grid grid-cols-3 gap-4">
                <SelectField label="Tipe" value={form.type || ''} onChange={e => setForm({ ...form, type: e.target.value })}>
                    <option value="">Pilih Tipe</option>
                    <option value="BAJU">Baju</option>
                    <option value="CELANA">Celana</option>
                    <option value="JILBAB">Jilbab</option>
                    <option value="TOPI">Topi</option>
                    <option value="DASI">Dasi</option>
                    <option value="ATRIBUT">Atribut</option>
                </SelectField>
                <SelectField label="Gender" value={form.gender || ''} onChange={e => setForm({ ...form, gender: e.target.value })}>
                    <option value="">Semua</option>
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                    <option value="UNISEX">Unisex</option>
                </SelectField>
                <SelectField label="Jenjang" value={form.targetUnit || ''} onChange={e => setForm({ ...form, targetUnit: e.target.value })}>
                    <option value="">Semua</option>
                    <option value="TK">TK</option>
                    <option value="SD">SD</option>
                    <option value="SMP">SMP</option>
                    <option value="SMA">SMA</option>
                </SelectField>
            </div>
            <InputField label="Harga Jual (Rp)" type="number" value={form.sellPrice || ''} onChange={e => setForm({ ...form, sellPrice: e.target.value })} />
            <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Ukuran</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                    {(form.sizes || []).map(s => (
                        <span key={s} className="px-2 py-1 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg text-xs font-bold flex items-center gap-1">
                            {s} <button onClick={() => removeSize(s)} className="hover:text-red-500"><X size={12} /></button>
                        </span>
                    ))}
                </div>
                <div className="flex gap-2">
                    <input className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm" value={sizeInput} onChange={e => setSizeInput(e.target.value)} placeholder="Tambah ukuran" onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSize())} />
                    <button onClick={addSize} className="px-3 py-2 bg-slate-100 rounded-xl text-sm font-bold hover:bg-slate-200"><Plus size={14} /></button>
                </div>
            </div>
            <button onClick={() => onSave(form)} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 transition-all">Simpan</button>
        </div>
    );
};

export const TransactionForm = ({ warehouses, vendors, onSave }) => {
    const [form, setForm] = useState({ type: 'IN', quantity: 1, costPerUnit: 0 });
    const [allVariants, setAllVariants] = useState([]);

    useEffect(() => {
        api.get('/uniforms/items').then(r => {
            const variants = [];
            r.data.forEach(item => {
                item.variants?.forEach(v => {
                    variants.push({ ...v, itemName: item.name });
                });
            });
            setAllVariants(variants);
        });
    }, []);

    return (
        <div className="space-y-4">
            <SelectField label="Tipe Transaksi" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                <option value="IN">Barang Masuk (IN)</option>
                <option value="OUT">Barang Keluar (OUT)</option>
                <option value="MUTATION">Mutasi Antar Gudang</option>
                <option value="ADJUSTMENT">Penyesuaian Stok</option>
            </SelectField>
            <SelectField label="Barang (Variant)" value={form.variantId || ''} onChange={e => setForm({ ...form, variantId: e.target.value })}>
                <option value="">Pilih Barang</option>
                {allVariants.map(v => <option key={v.id} value={v.id}>{v.itemName} - {v.size} ({v.sku})</option>)}
            </SelectField>
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

export const PackageForm = ({ items, initialData, onSave }) => {
    const [form, setForm] = useState(initialData || { isFixedPrice: true, items: [] });
    const [selectedItem, setSelectedItem] = useState('');

    const addItem = () => {
        if (!selectedItem) return;
        const item = items.find(i => String(i.id) === String(selectedItem));
        if (!item || form.items?.some(fi => fi.itemId === item.id)) return;
        setForm({ ...form, items: [...(form.items || []), { itemId: item.id, itemName: item.name, qty: 1 }] });
        setSelectedItem('');
    };

    return (
        <div className="space-y-4">
            <InputField label="Nama Paket" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Paket Siswa Baru SMP Putra" required />
            <div className="grid grid-cols-3 gap-4">
                <SelectField label="Jenjang" value={form.targetUnit || ''} onChange={e => setForm({ ...form, targetUnit: e.target.value })}>
                    <option value="">Semua</option>
                    <option value="TK">TK</option><option value="SD">SD</option><option value="SMP">SMP</option><option value="SMA">SMA</option>
                </SelectField>
                <SelectField label="Gender" value={form.gender || ''} onChange={e => setForm({ ...form, gender: e.target.value })}>
                    <option value="">Semua</option>
                    <option value="L">Putra</option><option value="P">Putri</option>
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
                    <select className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white" value={selectedItem} onChange={e => setSelectedItem(e.target.value)}>
                        <option value="">Pilih Barang</option>
                        {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                    <button onClick={addItem} className="px-3 py-2 bg-slate-100 rounded-xl hover:bg-slate-200"><Plus size={14} /></button>
                </div>
            </div>
            <button onClick={() => onSave(form)} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20">Simpan Paket</button>
        </div>
    );
};
