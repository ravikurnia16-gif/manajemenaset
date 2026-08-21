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
        customerName: '', customerPhone: '', studentName: '', studentClass: '', targetUnit: '', gender: '',
        packageId: '', subtotal: 0, discount: 0, totalAmount: 0, paidAmount: 0,
        paymentStatus: 'UNPAID', paymentMethod: 'CASH', status: 'COMPLETED', items: [],
        packages: [] // array of { packageId, name, price, qty, items: [] }
    });

    const [retailInput, setRetailInput] = useState({
        category: '',
        clothingType: '',
        size: '',
        qty: 1
    });

    useEffect(() => {
        let subtotal = 0;
        if (form.type === 'SPMB' || form.type === 'UNIT_ORDER') {
            form.packages.forEach(pkg => {
                const uniqueSizes = [...new Set(pkg.items.map(i => i.size))];
                const totalPackages = uniqueSizes.reduce((sum, size) => {
                    const sample = pkg.items.find(i => i.size === size);
                    return sum + (sample ? sample.qty : 0);
                }, 0);
                subtotal += totalPackages * pkg.price;
            });
        } else {
            subtotal = form.items.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);
        }
        
        const totalAmount = subtotal - (parseFloat(form.discount) || 0);
        let paymentStatus = 'UNPAID';
        if (parseFloat(form.paidAmount) >= totalAmount && totalAmount > 0) paymentStatus = 'PAID';
        else if (parseFloat(form.paidAmount) > 0) paymentStatus = 'PARTIAL';

        setForm(f => ({ ...f, subtotal, totalAmount, paymentStatus }));
    }, [form.items, form.packages, form.discount, form.paidAmount, form.type]);

    const handleAddPackage = (pkgId) => {
        if (!pkgId) return;
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
            
            setForm({
                ...form,
                packages: [
                    ...form.packages,
                    { packageId: pkg.id, name: pkg.name, price: pkg.price, items: pkgItems }
                ]
            });
        }
    };

    const updatePackageItemQty = (pkgIndex, sizeName, newQty) => {
        const newPackages = [...form.packages];
        newPackages[pkgIndex].items = newPackages[pkgIndex].items.map(i => 
            i.size === sizeName ? { ...i, qty: newQty } : i
        );
        const uniqueSizes = [...new Set(newPackages[pkgIndex].items.map(i => i.size))];
        const totalPackages = uniqueSizes.reduce((sum, size) => {
            const sample = newPackages[pkgIndex].items.find(i => i.size === size);
            return sum + (sample ? sample.qty : 0);
        }, 0);
        newPackages[pkgIndex].qty = totalPackages;
        
        setForm({ ...form, packages: newPackages });
    };

    const removePackage = (pkgIndex) => {
        setForm({ ...form, packages: form.packages.filter((_, i) => i !== pkgIndex) });
    };

    const availableRetailVariants = form.type === 'RETAIL' && form.targetUnit && form.gender 
        ? variants.filter(v => v.item?.unit?.name === form.targetUnit && v.item?.gender === form.gender)
        : [];
    
    const availableCategories = [...new Set(availableRetailVariants.map(v => v.item?.category?.name))].filter(Boolean);
    const availableClothingTypes = retailInput.category
        ? [...new Set(availableRetailVariants.filter(v => v.item?.category?.name === retailInput.category).map(v => v.item?.clothingType?.name))].filter(Boolean)
        : [];
        
    let availableSizes = [];
    if (retailInput.clothingType === 'SEMUA_SETELAN') {
        availableSizes = [...new Set(availableRetailVariants.filter(v => v.item?.category?.name === retailInput.category).map(v => v.size?.name || v.sizeName))].filter(Boolean);
    } else if (retailInput.clothingType) {
        availableSizes = [...new Set(availableRetailVariants.filter(v => v.item?.category?.name === retailInput.category && v.item?.clothingType?.name === retailInput.clothingType).map(v => v.size?.name || v.sizeName))].filter(Boolean);
    }

    const getSizePriceStr = (sizeName) => {
        let targets = [];
        if (retailInput.clothingType === 'SEMUA_SETELAN') {
            targets = availableRetailVariants.filter(v => v.item?.category?.name === retailInput.category && (v.size?.name || v.sizeName) === sizeName);
        } else {
            targets = availableRetailVariants.filter(v => v.item?.category?.name === retailInput.category && v.item?.clothingType?.name === retailInput.clothingType && (v.size?.name || v.sizeName) === sizeName);
        }
        if (targets.length === 0) return '';
        const totalPrice = targets.reduce((sum, v) => {
            const price = (v.sellPrice !== null && v.sellPrice !== undefined) ? v.sellPrice : (v.item?.sellPrice || 0);
            return sum + price;
        }, 0);
        return ` - Rp ${totalPrice.toLocaleString('id-ID')}`;
    };

    const addRetailItemAdvanced = () => {
        if (!retailInput.category || !retailInput.clothingType || !retailInput.size || retailInput.qty < 1) {
            alert('Mohon lengkapi pilihan kategori, jenis, ukuran, dan jumlah.');
            return;
        }

        const newItems = [...form.items];
        let targetVariants = [];

        if (retailInput.clothingType === 'SEMUA_SETELAN') {
            targetVariants = availableRetailVariants.filter(v => v.item?.category?.name === retailInput.category && (v.size?.name || v.sizeName) === retailInput.size);
        } else {
            targetVariants = availableRetailVariants.filter(v => v.item?.category?.name === retailInput.category && v.item?.clothingType?.name === retailInput.clothingType && (v.size?.name || v.sizeName) === retailInput.size);
        }

        if (targetVariants.length === 0) {
            alert('Barang tidak ditemukan di database dengan ukuran tersebut.');
            return;
        }

        targetVariants.forEach(v => {
            newItems.push({
                variantId: v.id,
                itemName: `${v.item?.name} (${v.size?.name || v.sizeName})`,
                size: v.size?.name || v.sizeName,
                qty: parseInt(retailInput.qty),
                unitPrice: (v.sellPrice !== null && v.sellPrice !== undefined) ? v.sellPrice : (v.item?.sellPrice || 0)
            });
        });

        setForm({ ...form, items: newItems });
        setRetailInput({ ...retailInput, size: '', qty: 1 }); // reset selected size
    };

    const updateItemQty = (idx, qty) => {
        const newItems = [...form.items];
        newItems[idx].qty = parseInt(qty) || 1;
        setForm({ ...form, items: newItems });
    };
    
    const removeItem = (idx) => {
        setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <SelectField label="Tipe Pesanan" value={form.type} onChange={e => setForm({ ...form, type: e.target.value, items: [], packages: [], status: e.target.value === 'SPMB' ? 'PENDING' : 'COMPLETED' })}>
                    <option value="RETAIL">Eceran (Retail)</option>
                    <option value="SPMB">Pesanan Unit / SPMB</option>
                </SelectField>
                {form.type === 'RETAIL' && (
                    <SelectField label="Lokasi Gudang" value={form.warehouseId} onChange={e => setForm({ ...form, warehouseId: e.target.value })}>
                        <option value="">-- Pilih Gudang --</option>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </SelectField>
                )}
            </div>

            <div className={`grid ${form.type === 'RETAIL' ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2'} gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100`}>
                {form.type === 'RETAIL' ? (
                    <>
                        <InputField label="Nama Siswa *" value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} required placeholder="Misal: Ahmad" />
                        <InputField label="No HP (WA)" value={form.customerPhone} onChange={e => setForm({ ...form, customerPhone: e.target.value })} placeholder="Misal: 08123..." />
                        <SelectField label="Jenjang / Unit *" value={form.targetUnit} onChange={e => setForm({ ...form, targetUnit: e.target.value, items: [] })} required>
                            <option value="">-- Pilih Unit --</option>
                            {units.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                        </SelectField>
                        <SelectField label="Gender *" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value, items: [] })} required>
                            <option value="">-- Pilih Gender --</option>
                            <option value="IKHWAN">Ikhwan</option>
                            <option value="AKHWAT">Akhwat</option>
                        </SelectField>
                    </>
                ) : (
                    <>
                        <SelectField label="Jenjang / Unit *" value={form.targetUnit} onChange={e => setForm({ ...form, targetUnit: e.target.value })} required>
                            <option value="">-- Pilih Unit --</option>
                            {units.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                        </SelectField>
                        <SelectField label="Tambah Paket *" value="" onChange={e => handleAddPackage(e.target.value)} disabled={!form.targetUnit}>
                            <option value="">-- Tambah Paket --</option>
                            {packages
                                .filter(p => !form.targetUnit || p.targetUnit === form.targetUnit || !p.targetUnit || p.targetUnit === 'ALL')
                                .map(p => <option key={p.id} value={p.id}>{p.name} (Rp {p.price.toLocaleString()})</option>)}
                        </SelectField>
                    </>
                )}
            </div>

            {form.type === 'SPMB' && (
                <div className="space-y-4">
                    {form.packages.map((pkg, pkgIndex) => (
                        <div key={pkgIndex} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 relative">
                            <button type="button" onClick={() => removePackage(pkgIndex)} className="absolute top-3 right-3 text-red-500 hover:text-red-700 bg-red-50 rounded p-1"><X size={16} /></button>
                            <div>
                                <label className="block text-sm font-bold text-blue-800">{pkg.name}</label>
                                <div className="text-xs text-slate-500">Harga Paket: Rp {pkg.price.toLocaleString()} &bull; Total Dipesan: {pkg.qty || 0} Paket</div>
                            </div>
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 mt-2">
                                {[...new Set(pkg.items.map(i => i.size))].map(sizeName => {
                                    const sampleItem = pkg.items.find(i => i.size === sizeName);
                                    return (
                                        <div key={sizeName} className="flex items-center gap-2 bg-white border border-slate-200 rounded p-1.5 shadow-sm">
                                            <span className="text-xs font-bold text-slate-700 w-10 text-center">{sizeName}</span>
                                            <input 
                                                type="number" min="0" 
                                                className="w-full border-l border-slate-200 pl-2 py-1 text-sm font-bold text-blue-700 outline-none" 
                                                value={sampleItem?.qty || ''} 
                                                onChange={e => {
                                                    const newQty = parseInt(e.target.value) || 0;
                                                    updatePackageItemQty(pkgIndex, sizeName, newQty);
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

            {form.type === 'RETAIL' && (
                <div className="space-y-4">
                    <label className="block text-xs font-bold text-slate-500 uppercase">Inputan Pesanan</label>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        <SelectField label="Kategori Seragam" value={retailInput.category} onChange={e => setRetailInput({ ...retailInput, category: e.target.value, clothingType: '', size: '' })} disabled={!form.targetUnit || !form.gender}>
                            <option value="">-- Kategori --</option>
                            {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                        </SelectField>

                        <SelectField label="Jenis Pakaian" value={retailInput.clothingType} onChange={e => setRetailInput({ ...retailInput, clothingType: e.target.value, size: '' })} disabled={!retailInput.category}>
                            <option value="">-- Jenis --</option>
                            {availableClothingTypes.map(c => <option key={c} value={c}>{c}</option>)}
                            {availableClothingTypes.length > 1 && <option value="SEMUA_SETELAN" className="font-bold text-blue-600">Baju & Celana (Setelan)</option>}
                        </SelectField>

                        <SelectField label="Ukuran" value={retailInput.size} onChange={e => setRetailInput({ ...retailInput, size: e.target.value })} disabled={!retailInput.clothingType}>
                            <option value="">-- Ukuran --</option>
                            {availableSizes.map(s => (
                                <option key={s} value={s}>
                                    {s}{getSizePriceStr(s)}
                                </option>
                            ))}
                        </SelectField>
                        
                        <InputField type="number" min="1" label="Jumlah" value={retailInput.qty} onChange={e => setRetailInput({ ...retailInput, qty: e.target.value })} disabled={!retailInput.size} />
                        
                        <div className="flex items-end">
                            <button type="button" onClick={addRetailItemAdvanced} className="w-full h-[46px] flex items-center justify-center gap-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50" disabled={!retailInput.size}>
                                <Plus size={18} /> Tambah
                            </button>
                        </div>
                    </div>

                    {retailInput.size && (
                        <div className="text-sm font-bold text-slate-700 bg-blue-50/50 p-3 rounded-xl border border-blue-100/50 inline-block">
                            Estimasi Harga Satuan: <span className="text-blue-600 text-lg font-black">{getSizePriceStr(retailInput.size).replace(' - ', '')}</span>
                        </div>
                    )}

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
                        const dataToSave = { ...form };
                        if (form.type === 'SPMB') {
                            dataToSave.packages = dataToSave.packages.map(p => ({
                                ...p, items: p.items.filter(i => i.qty > 0)
                            })).filter(p => p.items.length > 0);
                            
                            if (!dataToSave.customerName) dataToSave.customerName = `Pesanan SPMB ${form.targetUnit || ''}`;
                            if (!dataToSave.warehouseId && warehouses.length > 0) dataToSave.warehouseId = warehouses[0].id;
                            dataToSave.status = 'PENDING';
                            dataToSave.paidAmount = 0; 
                            dataToSave.discount = 0;
                            dataToSave.paymentMethod = '';
                        } else {
                            dataToSave.items = form.items.filter(i => i.qty > 0);
                        }
                        onSave(dataToSave);
                    }} 
                    disabled={
                        (form.type === 'RETAIL' && (!form.warehouseId || form.items.filter(i => i.qty > 0).length === 0)) || 
                        (form.type === 'SPMB' && form.packages.length === 0)
                    }
                    className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition disabled:opacity-50 disabled:grayscale"
                >
                    Simpan Pesanan
                </button>
            </div>
        </div>
    );
};
