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


export const TransactionForm = ({ warehouses, vendors, onSave }) => {
    const [form, setForm] = useState({ type: 'IN', quantity: 1, costPerUnit: 0 });
    const [allVariants, setAllVariants] = useState([]);

    useEffect(() => {
        api.get('/uniforms/items').then(r => {
            const variants = [];
            r.data.forEach(item => {
                if (item.variants && item.variants.length > 0) {
                    item.variants.forEach(v => {
                        variants.push({ ...v, itemName: item.name });
                    });
                }
            });
            setAllVariants(variants);
        }).catch(err => {
            console.error('Failed to fetch items:', err);
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
                {allVariants.map(v => <option key={v.id} value={v.id}>{v.itemName} - {v.sizeName} ({v.sku})</option>)}
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

export const PackageForm = ({ items: initialItems, units, initialData, onSave }) => {
    const [form, setForm] = useState(initialData || { isFixedPrice: true, items: [] });
    const [selectedItem, setSelectedItem] = useState('');
    const [items, setItems] = useState(initialItems || []);

    useEffect(() => {
        if (items.length === 0) {
            api.get('/uniforms/items').then(r => setItems(r.data)).catch(console.error);
        }
    }, []);

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
export const ManualStockForm = ({ categories = [], clothingTypes = [], units = [], sizes = [], warehouses = [], vendors = [], onSave }) => {
    const [form, setForm] = useState({
        kategori: '',
        jenisPakaian: '',
        unit: '',
        gender: '',
        ukuran: '',
        gudang: '',
        vendor: '',
        hargaModal: 0,
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
                    <option value="IKHWAN">IKHWAN</option>
                    <option value="AKHWAT">AKHWAT</option>
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
                    <option value="">Tanpa Vendor</option>
                    {vendors.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                </SelectField>
            </div>

            <div className="grid grid-cols-3 gap-4">
                <InputField label="Stok *" type="number" name="stok" value={form.stok} onChange={handleChange} required />
                <InputField label="Stok Minimal" type="number" name="stokMinimal" value={form.stokMinimal} onChange={handleChange} />
                <InputField label="Harga Modal (Rp)" type="number" name="hargaModal" value={form.hargaModal} onChange={handleChange} />
            </div>

            <button onClick={() => onSave(form)} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 mt-4">
                Simpan Stok
            </button>
        </div>
    );
};
