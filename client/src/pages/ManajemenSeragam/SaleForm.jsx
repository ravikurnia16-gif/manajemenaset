import { useState, useEffect } from 'react';
import { X, Search, Plus, Save } from 'lucide-react';

const InputField = ({ label, ...props }) => (
    <div className="space-y-1.5">
        <label className="block text-xs font-bold text-slate-500 uppercase">{label}</label>
        <input className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" {...props} />
    </div>
);

const SelectField = ({ label, children, ...props }) => (
    <div className="space-y-1.5">
        <label className="block text-xs font-bold text-slate-500 uppercase">{label}</label>
        <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" {...props}>
            {children}
        </select>
    </div>
);

export const SaleForm = ({ warehouses = [], packages = [], variants = [], units = [], onSave, initialData }) => {
    const [form, setForm] = useState(initialData || {
        type: 'RETAIL', warehouseId: warehouses[0]?.id || '',
        customerName: '', customerPhone: '', studentName: '', studentClass: '', targetUnit: '',
        packageId: '', subtotal: 0, discount: 0, totalAmount: 0, paidAmount: 0,
        paymentStatus: 'UNPAID', paymentMethod: 'CASH', status: 'COMPLETED', items: []
    });

    const [variantSearch, setVariantSearch] = useState('');
    const [selectedVariant, setSelectedVariant] = useState('');

    useEffect(() => {
        const subtotal = form.items.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);
        const totalAmount = subtotal - (parseFloat(form.discount) || 0);
        let paymentStatus = 'UNPAID';
        if (parseFloat(form.paidAmount) >= totalAmount && totalAmount > 0) paymentStatus = 'PAID';
        else if (parseFloat(form.paidAmount) > 0) paymentStatus = 'PARTIAL';

        setForm(f => ({ ...f, subtotal, totalAmount, paymentStatus }));
    }, [form.items, form.discount, form.paidAmount]);

    const handlePackageSelect = (pkgId) => {
        const pkg = packages.find(p => String(p.id) === String(pkgId));
        if (pkg) {
            const pkgItems = [];
            pkg.items.forEach(pi => {
                const itemVariants = variants.filter(v => String(v.itemId) === String(pi.itemId));
                itemVariants.forEach(v => {
                    pkgItems.push({
                        variantId: v.id,
                        itemName: v.item?.name || pi.item?.name || '',
                        categoryName: v.item?.category?.name || pi.item?.category?.name || 'Tanpa Kategori',
                        size: v.size?.name || v.sizeName,
                        qty: 0,
                        unitPrice: 0 
                    });
                });
            });
            setForm({ ...form, packageId: pkgId, items: pkgItems, subtotal: pkg.price, isFixedPrice: pkg.isFixedPrice });
        } else {
            setForm({ ...form, packageId: '', items: [] });
        }
    };

    const addRetailItem = () => {
        if (!selectedVariant) return;
        const v = variants.find(x => String(x.id) === String(selectedVariant));
        if (!v) return;
        setForm({
            ...form, items: [...form.items, {
                variantId: v.id,
                itemName: `${v.item?.name} (${v.size?.name || v.sizeName})`,
                size: v.size?.name || v.sizeName,
                qty: 1,
                unitPrice: v.item?.sellPrice || 0
            }]
        });
        setVariantSearch('');
        setSelectedVariant('');
    };

    const updateItemQty = (idx, qty) => {
        const newItems = [...form.items];
        newItems[idx].qty = parseInt(qty) || 1;
        setForm({ ...form, items: newItems });
    };
    
    const updateItemSize = (idx, sizeName) => {
        const newItems = [...form.items];
        newItems[idx].size = sizeName;
        // Find variantId matching itemId and sizeName
        const matched = variants.find(v => String(v.itemId) === String(newItems[idx].itemId) && v.sizeName === sizeName);
        if (matched) {
            newItems[idx].variantId = matched.id;
        }
        setForm({ ...form, items: newItems });
    };

    const removeItem = (idx) => {
        setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <SelectField label="Tipe Pesanan" value={form.type} onChange={e => setForm({ ...form, type: e.target.value, items: [] })}>
                    <option value="RETAIL">Eceran (Retail)</option>
                    <option value="SPMB">Paket Siswa Baru (SPMB)</option>
                </SelectField>
                {form.type === 'RETAIL' && (
                    <SelectField label="Lokasi Gudang" value={form.warehouseId} onChange={e => setForm({ ...form, warehouseId: e.target.value })}>
                        <option value="">-- Pilih Gudang --</option>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </SelectField>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                {form.type === 'RETAIL' ? (
                    <>
                        <InputField label="Nama Pelanggan / Wali Murid *" value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} required />
                        <InputField label="No HP (WA)" value={form.customerPhone} onChange={e => setForm({ ...form, customerPhone: e.target.value })} />
                    </>
                ) : (
                    <>
                        <SelectField label="Jenjang / Unit *" value={form.targetUnit} onChange={e => setForm({ ...form, targetUnit: e.target.value })} required>
                            <option value="">-- Pilih Unit --</option>
                            {units.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                        </SelectField>
                        <SelectField label="Pilih Paket SPMB *" value={form.packageId} onChange={e => handlePackageSelect(e.target.value)} disabled={!form.targetUnit} required>
                            <option value="">-- Pilih Paket --</option>
                            {packages
                                .filter(p => !form.targetUnit || p.targetUnit === form.targetUnit || !p.targetUnit || p.targetUnit === 'ALL')
                                .map(p => <option key={p.id} value={p.id}>{p.name} (Rp {p.price.toLocaleString()})</option>)}
                        </SelectField>
                    </>
                )}
            </div>

            {form.type === 'SPMB' && (
                <div className="space-y-4">
                    {form.items.length > 0 && (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-800">Tentukan Jumlah Paket per Ukuran</label>
                                <p className="text-xs text-slate-500">Pilih jumlah ukuran untuk masing-masing kategori pakaian.</p>
                            </div>
                            
                            {Object.entries(form.items.reduce((acc, curr) => {
                                acc[curr.categoryName] = acc[curr.categoryName] || [];
                                acc[curr.categoryName].push(curr);
                                return acc;
                            }, {})).map(([category, catItems]) => (
                                <div key={category} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-2">
                                    <div className="text-sm font-bold text-slate-800">Kategori: {category}</div>
                                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                                        {[...new Set(catItems.map(i => i.size))].map(sizeName => {
                                            const sampleItem = catItems.find(i => i.size === sizeName);
                                            return (
                                                <div key={sizeName} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded p-1.5 shadow-sm">
                                                    <span className="text-xs font-bold text-slate-700 w-10 text-center">{sizeName}</span>
                                                    <input 
                                                        type="number" min="0" 
                                                        className="w-full border-l border-slate-200 pl-2 py-1 text-sm font-bold text-blue-700 outline-none bg-transparent" 
                                                        value={sampleItem?.qty || ''} 
                                                        onChange={e => {
                                                            const newQty = parseInt(e.target.value) || 0;
                                                            const newItems = form.items.map(i => (i.categoryName === category && i.size === sizeName) ? { ...i, qty: newQty } : i);
                                                            setForm({ ...form, items: newItems });
                                                        }} 
                                                        placeholder="0" 
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {form.type === 'RETAIL' && (
                <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Cari & Tambah Barang</label>
                    <div className="flex gap-2">
                        <input 
                            list="retail-variants"
                            className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Ketik SKU atau Nama Barang..."
                            value={variantSearch}
                            onChange={e => {
                                const val = e.target.value;
                                const match = variants.find(v => `${v.sku} - ${v.item?.name} (${v.sizeName})` === val);
                                setVariantSearch(val);
                                setSelectedVariant(match ? match.id : '');
                            }}
                        />
                        <datalist id="retail-variants">
                            {variants.map(v => <option key={v.id} value={`${v.sku} - ${v.item?.name} (${v.sizeName})`} />)}
                        </datalist>
                        <button type="button" onClick={addRetailItem} className="px-4 bg-slate-100 rounded-xl hover:bg-slate-200"><Plus size={16} /></button>
                    </div>

                    <div className="mt-2 space-y-1.5">
                        {form.items.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                <div className="flex-1 text-sm font-medium">{item.itemName}</div>
                                <div className="text-sm font-bold text-slate-600 w-24 text-right">Rp {item.unitPrice.toLocaleString()}</div>
                                <input type="number" min="1" className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-sm text-center" value={item.qty} onChange={e => updateItemQty(idx, e.target.value)} />
                                <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 p-1"><X size={16} /></button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="border-t pt-4 grid grid-cols-2 gap-4">
                <div className="space-y-4">
                    {form.type === 'RETAIL' && (
                        <>
                            <SelectField label="Status Pengambilan" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                                <option value="COMPLETED">Diambil Semua Sekarang (Stok Keluar)</option>
                                <option value="PENDING">Diambil Nanti (Backorder)</option>
                            </SelectField>
                            <SelectField label="Metode Pembayaran" value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })}>
                                <option value="CASH">Tunai (Cash)</option>
                                <option value="TRANSFER">Transfer Bank</option>
                                <option value="QRIS">QRIS</option>
                            </SelectField>
                        </>
                    )}
                    {form.type === 'SPMB' && (
                        <InputField type="date" label="Tenggat Pelunasan Tagihan *" value={form.dueDate || ''} onChange={e => setForm({ ...form, dueDate: e.target.value })} required />
                    )}
                </div>
                
                <div className="bg-blue-50 p-4 rounded-xl space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Subtotal</span>
                        <span className="font-bold">Rp {form.subtotal.toLocaleString()}</span>
                    </div>
                    {form.type === 'RETAIL' && (
                        <div className="flex justify-between text-sm items-center">
                            <span className="text-slate-500">Diskon</span>
                            <input type="number" className="w-24 border rounded px-2 py-1 text-right text-sm" value={form.discount} onChange={e => setForm({ ...form, discount: e.target.value })} />
                        </div>
                    )}
                    <div className="flex justify-between text-lg font-black text-blue-700 pt-2 border-t border-blue-100">
                        <span>Total Tagihan</span>
                        <span>Rp {form.totalAmount.toLocaleString()}</span>
                    </div>
                    {form.type === 'RETAIL' && (
                        <div className="flex justify-between text-sm items-center pt-2">
                            <span className="text-slate-500 font-bold">Dibayar</span>
                            <input type="number" className="w-32 border border-blue-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg px-2 py-1 text-right font-bold text-slate-700" value={form.paidAmount} onChange={e => setForm({ ...form, paidAmount: e.target.value })} />
                        </div>
                    )}
                </div>
            </div>

            <div className="pt-2">
                <button 
                    onClick={() => {
                        const dataToSave = { ...form, items: form.items.filter(i => i.qty > 0) };
                        if (form.type === 'SPMB') {
                            if (!dataToSave.customerName) dataToSave.customerName = `Pesanan SPMB ${form.targetUnit || ''}`;
                            if (!dataToSave.warehouseId && warehouses.length > 0) dataToSave.warehouseId = warehouses[0].id;
                            dataToSave.status = 'PENDING';
                            dataToSave.paidAmount = 0; // Ensure it's marked as UNPAID
                            dataToSave.discount = 0;
                            dataToSave.paymentMethod = '';
                            if (form.dueDate) {
                                dataToSave.note = (dataToSave.note || '') + `\n[DEADLINE:${form.dueDate}]`;
                            }
                        }
                        onSave(dataToSave);
                    }} 
                    disabled={form.items.filter(i => i.qty > 0).length === 0 || (form.type === 'RETAIL' && !form.warehouseId) || (form.type === 'SPMB' && (!form.packageId || !form.dueDate))}
                    className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition disabled:opacity-50 disabled:grayscale"
                >
                    Simpan Pesanan
                </button>
            </div>
        </div>
    );
};
