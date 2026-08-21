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
    const defaultYear = new Date().getFullYear().toString();
    
    const [form, setForm] = useState(() => {
        let year = defaultYear;
        let name = `Paket ${defaultYear}`;
        
        if (initialData) {
             const yearMatch = initialData.name?.match(/\b(\d{4})\b/);
             if (yearMatch) year = yearMatch[1];
             return { ...initialData, year };
        }
        return { isFixedPrice: true, items: [], year, name };
    });

    const items = initialItems || [];
    
    const handleAutoPopulate = (field, value) => {
        const newForm = { ...form, [field]: value };
        
        const genderText = newForm.gender === 'IKHWAN' ? 'Ikhwan' : newForm.gender === 'AKHWAT' ? 'Akhwat' : (newForm.gender || '');
        newForm.name = `Paket ${genderText} ${newForm.targetUnit || ''} ${newForm.year || ''}`.replace(/\s+/g, ' ').trim();
        
        setForm(newForm);

        if (newForm.targetUnit && newForm.gender) {
            const matchingItems = items.filter(i => 
                i.unit?.name === newForm.targetUnit && 
                i.gender === newForm.gender
            );

            const newItems = matchingItems.map(i => ({ 
                itemId: i.id, 
                itemName: `${i.category?.name || ''} ${i.gender || ''} ${i.unit?.name || ''} ${i.clothingType?.name || ''}`.trim(), 
                qty: 1 
            }));

            setForm(f => ({ ...f, items: newItems, [field]: value }));
        }
    };

    const handleSave = () => {
        onSave({
            ...form,
            price: parseFloat(form.price) || 0,
            targetUnit: form.targetUnit || 'ALL',
            gender: form.gender || 'ALL',
        });
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
                <InputField label="Nama Paket (Otomatis)" value={form.name || ''} readOnly disabled style={{ backgroundColor: '#f8fafc', color: '#64748b' }} />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <SelectField label="Jenjang / Unit *" value={form.targetUnit || ''} onChange={e => handleAutoPopulate('targetUnit', e.target.value)} required>
                        <option value="">Pilih Unit</option>
                        {units?.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                    </SelectField>
                    <SelectField label="Gender *" value={form.gender || ''} onChange={e => handleAutoPopulate('gender', e.target.value)} required>
                        <option value="">Pilih Gender</option>
                        <option value="IKHWAN">Ikhwan</option>
                        <option value="AKHWAT">Akhwat</option>
                    </SelectField>
                    <InputField label="Tahun *" type="number" value={form.year || ''} onChange={e => handleAutoPopulate('year', e.target.value)} required />
                </div>
            </div>
            <InputField label="Harga Paket (Rp)" type="number" value={form.price || ''} onChange={e => setForm({ ...form, price: e.target.value })} required />

            {form.items?.length > 0 && (
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Daftar Isi Paket</label>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-2">
                        {(() => {
                            const groupedItems = (form.items || []).reduce((acc, fi) => {
                                const actualItem = items.find(i => i.id === fi.itemId);
                                if (!actualItem) return acc;
                                const genderFormat = actualItem.gender === 'IKHWAN' ? 'Ikhwan' : actualItem.gender === 'AKHWAT' ? 'Akhwat' : actualItem.gender;
                                const groupName = `${actualItem.category?.name || ''} ${genderFormat || ''} ${actualItem.unit?.name || ''}`.trim();
                                
                                if (!acc[groupName]) {
                                    acc[groupName] = [];
                                }
                                acc[groupName].push(fi.itemId);
                                return acc;
                            }, {});

                            return Object.entries(groupedItems).map(([groupName, itemIds], idx) => (
                                <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    <span className="flex-1 text-sm font-medium text-slate-700">{groupName}</span>
                                    <button 
                                        onClick={() => setForm({ 
                                            ...form, 
                                            items: form.items.filter(fi => !itemIds.includes(fi.itemId)) 
                                        })} 
                                        className="text-red-400 hover:text-red-600 p-1"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ));
                        })()}
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
