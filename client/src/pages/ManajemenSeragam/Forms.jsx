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


export const TransactionForm = ({ variants = [], warehouses = [], onSave }) => {
    const [type, setType] = useState('IN');
    const [warehouseId, setWarehouseId] = useState('');
    const [toWarehouseId, setToWarehouseId] = useState('');
    const [note, setNote] = useState('');
    const [reason, setReason] = useState('');
    const [items, setItems] = useState([{ variantId: '', variantSearch: '', quantity: 1 }]);

    const addItem = () => setItems([...items, { variantId: '', variantSearch: '', quantity: 1 }]);
    const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));

    const updateItem = (idx, field, value) => {
        setItems(prev => prev.map((item, i) => {
            if (i !== idx) return item;
            if (field === 'variantSearch') {
                const match = variants.find(v => `${v.sku} - ${v.item?.name} (${v.sizeName})` === value);
                return { ...item, variantSearch: value, variantId: match ? match.id : '' };
            }
            return { ...item, [field]: value };
        }));
    };

    const warehouseLabel = type === 'IN' ? 'Gudang Tujuan' : type === 'MUTATION' ? 'Gudang Asal' : 'Gudang';
    const allItemsValid = items.every(it => it.variantId && it.quantity > 0);
    const canSave = warehouseId && allItemsValid && items.length > 0 && (type !== 'MUTATION' || toWarehouseId);

    const handleSave = () => {
        if (items.length === 1) {
            onSave({ type, variantId: items[0].variantId, warehouseId, toWarehouseId: toWarehouseId || undefined, quantity: items[0].quantity, reason, note });
        } else {
            onSave({ type, warehouseId, toWarehouseId: toWarehouseId || undefined, reason, note, batch: items.map(it => ({ variantId: it.variantId, quantity: it.quantity })) });
        }
    };

    return (
        <div className="space-y-4">
            <SelectField label="Tipe Transaksi" value={type} onChange={e => { setType(e.target.value); setToWarehouseId(''); }}>
                <option value="IN">Barang Masuk (IN)</option>
                <option value="OUT">Barang Keluar (OUT)</option>
                <option value="MUTATION">Mutasi Antar Gudang</option>
                <option value="ADJUSTMENT">Penyesuaian Stok</option>
            </SelectField>

            <div className={`grid gap-4 ${type === 'MUTATION' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <SelectField label={warehouseLabel + ' *'} value={warehouseId} onChange={e => setWarehouseId(e.target.value)}>
                    <option value="">Pilih Gudang</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </SelectField>
                {type === 'MUTATION' && (
                    <SelectField label="Gudang Tujuan *" value={toWarehouseId} onChange={e => setToWarehouseId(e.target.value)}>
                        <option value="">Pilih Gudang Tujuan</option>
                        {warehouses.filter(w => String(w.id) !== String(warehouseId)).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </SelectField>
                )}
            </div>

            <div className="space-y-3">
                <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Daftar Barang *</label>
                    <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
                        <Plus size={14} /> Tambah Barang
                    </button>
                </div>

                {items.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-end bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div className="flex-1 flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Barang #{idx + 1}</label>
                            <input
                                list={`trx-variants-list-${idx}`}
                                value={item.variantSearch || ''}
                                onChange={e => updateItem(idx, 'variantSearch', e.target.value)}
                                placeholder="Ketik SKU atau Nama Barang..."
                                className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all w-full"
                            />
                            <datalist id={`trx-variants-list-${idx}`}>
                                {variants.map(v => (
                                    <option key={v.id} value={`${v.sku} - ${v.item?.name} (${v.sizeName})`} />
                                ))}
                            </datalist>
                        </div>
                        <div className="w-24 flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Qty</label>
                            <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                                className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-100 outline-none text-center w-full"
                            />
                        </div>
                        {items.length > 1 && (
                            <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors mb-0.5">
                                <X size={16} />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {type === 'ADJUSTMENT' && (
                <InputField label="Alasan Penyesuaian *" value={reason} onChange={e => setReason(e.target.value)} placeholder="Contoh: Cacat dari vendor, Hilang" required />
            )}
            <InputField label="Catatan" value={note} onChange={e => setNote(e.target.value)} />
            <button onClick={handleSave} disabled={!canSave} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 disabled:opacity-50">
                Simpan {items.length > 1 ? `${items.length} Transaksi` : 'Transaksi'}
            </button>
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
