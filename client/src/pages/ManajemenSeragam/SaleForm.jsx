import React, { useState, useEffect } from 'react';
import { X, Search, Plus, Save, ShoppingBag, Info, User, Phone, School, Sparkles } from 'lucide-react';
import api from '../../lib/axios';

const InputField = ({ label, ...props }) => (
    <div className="space-y-1.5">
        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">{label}</label>
        <input className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition" {...props} />
    </div>
);

const SelectField = ({ label, children, ...props }) => (
    <div className="space-y-1.5">
        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">{label}</label>
        <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition" {...props}>
            {children}
        </select>
    </div>
);

export const SaleForm = ({ warehouses = [], packages = [], variants = [], units = [], onSave, initialData }) => {
    const defaultWarehouseId = warehouses[0]?.id || '';

    const [form, setForm] = useState(initialData || {
        type: 'RETAIL',
        warehouseId: defaultWarehouseId,
        customerName: '',
        customerPhone: '',
        studentName: '',
        studentClass: '',
        targetUnit: '',
        gender: '',
        packageId: '',
        subtotal: 0,
        discount: 0,
        totalAmount: 0,
        paidAmount: 0,
        paymentStatus: 'UNPAID',
        paymentMethod: 'TRANSFER',
        status: 'PENDING',
        items: [],
        packages: [],
        note: ''
    });

    const [retailInput, setRetailInput] = useState({
        category: '',
        clothingType: '',
        size: '',
        qty: 1
    });

    const [namaDadaBasePrice, setNamaDadaBasePrice] = useState(15000);
    const [namaDadaPutihQty, setNamaDadaPutihQty] = useState(0);
    const [namaDadaCoklatQty, setNamaDadaCoklatQty] = useState(0);

    // Fetch harga Nama Dada
    useEffect(() => {
        api.get('/uniforms/public/nama-dada-price')
            .then(res => {
                if (res.data?.price) setNamaDadaBasePrice(res.data.price);
            })
            .catch(() => setNamaDadaBasePrice(15000));
    }, []);

    // Perhitungan Subtotal dan Total Tagihan
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
            const itemsSubtotal = form.items.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);
            const namaDadaTotal = (namaDadaPutihQty + namaDadaCoklatQty) * namaDadaBasePrice;
            subtotal = itemsSubtotal + namaDadaTotal;
        }
        
        const totalAmount = Math.max(0, subtotal - (parseFloat(form.discount) || 0));
        let paymentStatus = 'UNPAID';
        if (parseFloat(form.paidAmount) >= totalAmount && totalAmount > 0) paymentStatus = 'PAID';
        else if (parseFloat(form.paidAmount) > 0) paymentStatus = 'PARTIAL';

        setForm(f => ({ ...f, subtotal, totalAmount, paymentStatus }));
    }, [form.items, form.packages, form.discount, form.paidAmount, form.type, namaDadaPutihQty, namaDadaCoklatQty, namaDadaBasePrice]);

    // Available variants filtering for RETAIL (samakan dengan UniformOrderPublic)
    const availableRetailVariants = form.type === 'RETAIL' && form.targetUnit && form.gender
        ? variants.filter(v => {
            const unitName = v.item?.unit?.name || '';
            const isGeneralUnit = !v.item?.unit || unitName.toLowerCase() === 'umum' || unitName.toLowerCase() === 'semua unit';

            if (isGeneralUnit) {
                return v.item?.gender === form.gender || v.item?.gender === 'UMUM';
            }
            
            return unitName === form.targetUnit && 
                   (v.item?.gender === form.gender || v.item?.gender === 'UMUM');
        })
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
        setRetailInput({ ...retailInput, size: '', qty: 1 });
    };

    const updateItemQty = (idx, qty) => {
        const newItems = [...form.items];
        newItems[idx].qty = parseInt(qty) || 1;
        setForm({ ...form, items: newItems });
    };
    
    const removeItem = (idx) => {
        setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });
    };

    // SPMB Package Handlers
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

    const handleFormSubmit = (e) => {
        e.preventDefault();

        if (form.type === 'RETAIL') {
            if (form.items.length === 0 && namaDadaPutihQty === 0 && namaDadaCoklatQty === 0) {
                alert('Pilih setidaknya satu seragam atau nama dada.');
                return;
            }
            if (!form.customerName) {
                alert('Nama Siswa / Pemesan wajib diisi.');
                return;
            }
            if (!form.targetUnit) {
                alert('Jenjang / Unit wajib dipilih.');
                return;
            }
        }

        const dataToSave = {
            ...form,
            warehouseId: form.warehouseId || defaultWarehouseId,
            status: 'PENDING'
        };

        if (form.type === 'SPMB') {
            dataToSave.packages = dataToSave.packages.map(p => ({
                ...p, items: p.items.filter(i => i.qty > 0)
            })).filter(p => p.items.length > 0);
            
            if (!dataToSave.customerName) dataToSave.customerName = `Pesanan SPMB ${form.targetUnit || ''}`;
            dataToSave.paidAmount = 0; 
            dataToSave.discount = 0;
            dataToSave.paymentMethod = 'TRANSFER';
        } else {
            dataToSave.items = form.items.filter(i => i.qty > 0);

            // Format Nama Dada ke dalam Note
            let notesArr = [];
            if (namaDadaPutihQty > 0) notesArr.push(`[NAMADADA_PUTIH:${namaDadaPutihQty}:${namaDadaBasePrice}:PENDING]`);
            if (namaDadaCoklatQty > 0) notesArr.push(`[NAMADADA_COKLAT:${namaDadaCoklatQty}:${namaDadaBasePrice}:PENDING]`);
            if (form.note) notesArr.push(form.note);
            dataToSave.note = notesArr.join('\n');
        }

        onSave(dataToSave);
    };

    return (
        <form onSubmit={handleFormSubmit} className="space-y-4 animate-in fade-in duration-200">
            
            {/* Tipe Pesanan Switcher */}
            <div>
                <SelectField 
                    label="Tipe Pesanan" 
                    value={form.type} 
                    onChange={e => setForm({ 
                        ...form, 
                        type: e.target.value, 
                        items: [], 
                        packages: [], 
                        status: 'PENDING' 
                    })}
                >
                    <option value="RETAIL">🛍️ Eceran (Satuan / Wali Murid)</option>
                    <option value="SPMB">📦 Pesanan Unit / SPMB (Paket Massal)</option>
                </SelectField>
            </div>

            {/* Identitas Pemesan */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <User size={14} className="text-blue-600" />
                    Data Siswa & Pemesan
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <InputField 
                        label="Nama Siswa / Pemesan *" 
                        value={form.customerName} 
                        onChange={e => setForm({ ...form, customerName: e.target.value, studentName: e.target.value })} 
                        required 
                        placeholder="Contoh: Ahmad Fauzan" 
                    />
                    <InputField 
                        label="No. WhatsApp / HP" 
                        value={form.customerPhone} 
                        onChange={e => setForm({ ...form, customerPhone: e.target.value })} 
                        placeholder="Contoh: 08123456789" 
                    />
                    <SelectField 
                        label="Jenjang / Unit *" 
                        value={form.targetUnit} 
                        onChange={e => setForm({ ...form, targetUnit: e.target.value, items: [] })} 
                        required
                    >
                        <option value="">-- Pilih Unit --</option>
                        {units.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                    </SelectField>

                    {form.type === 'RETAIL' && (
                        <SelectField 
                            label="Jenis Kelamin *" 
                            value={form.gender} 
                            onChange={e => setForm({ ...form, gender: e.target.value, items: [] })} 
                            required
                        >
                            <option value="">-- Pilih Gender --</option>
                            <option value="IKHWAN">Ikhwan (Laki-laki)</option>
                            <option value="AKHWAT">Akhwat (Perempuan)</option>
                        </SelectField>
                    )}
                </div>
            </div>

            {/* Input Seragam Eceran (Format Persis Form Publik) */}
            {form.type === 'RETAIL' && (
                <div className="space-y-4">
                    <div className="bg-white p-4 rounded-2xl border border-blue-200 shadow-sm space-y-3">
                        <label className="block text-xs font-extrabold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                            <ShoppingBag size={14} className="text-blue-600" />
                            Pilih Seragam Satuan
                        </label>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                            <SelectField 
                                label="Kategori Seragam" 
                                value={retailInput.category} 
                                onChange={e => setRetailInput({ ...retailInput, category: e.target.value, clothingType: '', size: '' })} 
                                disabled={!form.targetUnit || !form.gender}
                            >
                                <option value="">-- Pilih Kategori --</option>
                                {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                            </SelectField>

                            <SelectField 
                                label="Jenis Pakaian" 
                                value={retailInput.clothingType} 
                                onChange={e => setRetailInput({ ...retailInput, clothingType: e.target.value, size: '' })} 
                                disabled={!retailInput.category}
                            >
                                <option value="">-- Pilih Jenis --</option>
                                {availableClothingTypes.map(c => <option key={c} value={c}>{c}</option>)}
                                {availableClothingTypes.length > 1 && (
                                    <option value="SEMUA_SETELAN" className="font-bold text-blue-600">
                                        👕👖 Baju & Celana (Setelan)
                                    </option>
                                )}
                            </SelectField>

                            <SelectField 
                                label="Ukuran" 
                                value={retailInput.size} 
                                onChange={e => setRetailInput({ ...retailInput, size: e.target.value })} 
                                disabled={!retailInput.clothingType}
                            >
                                <option value="">-- Pilih Ukuran --</option>
                                {availableSizes.map(s => (
                                    <option key={s} value={s}>
                                        {s}{getSizePriceStr(s)}
                                    </option>
                                ))}
                            </SelectField>
                            
                            <InputField 
                                type="number" 
                                min="1" 
                                label="Jumlah (Qty)" 
                                value={retailInput.qty} 
                                onChange={e => setRetailInput({ ...retailInput, qty: e.target.value })} 
                                disabled={!retailInput.size} 
                            />
                            
                            <div className="flex items-end">
                                <button 
                                    type="button" 
                                    onClick={addRetailItemAdvanced} 
                                    className="w-full h-[46px] flex items-center justify-center gap-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition shadow-sm" 
                                    disabled={!retailInput.size}
                                >
                                    <Plus size={18} /> Tambah
                                </button>
                            </div>
                        </div>

                        {retailInput.size && (
                            <div className="text-xs font-bold text-slate-700 bg-blue-50/70 p-2.5 rounded-xl border border-blue-200 inline-block">
                                Estimasi Harga: <span className="text-blue-700 font-extrabold">{getSizePriceStr(retailInput.size).replace(' - ', '')}</span>
                            </div>
                        )}

                        {/* List Item yang Sudah Masuk Keranjang */}
                        {form.items.length > 0 && (
                            <div className="mt-3 space-y-2 pt-3 border-t border-slate-100">
                                <div className="text-xs font-bold text-slate-500 uppercase">Keranjang Seragam:</div>
                                {form.items.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
                                        <div className="flex-1">
                                            <div className="text-xs font-bold text-slate-800">{item.itemName}</div>
                                            <div className="text-[11px] text-slate-500">Rp {item.unitPrice.toLocaleString('id-ID')} / pcs</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="number" 
                                                min="1" 
                                                className="w-16 border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-center bg-white" 
                                                value={item.qty} 
                                                onChange={e => updateItemQty(idx, e.target.value)} 
                                            />
                                            <span className="text-xs font-extrabold text-blue-700 w-24 text-right">
                                                Rp {(item.unitPrice * item.qty).toLocaleString('id-ID')}
                                            </span>
                                            <button 
                                                type="button" 
                                                onClick={() => removeItem(idx)} 
                                                className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded-lg"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Opsi Bordir Nama Dada (Sesuai Form Publik) */}
                    <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-200 space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                                    <Sparkles size={14} className="text-amber-600" />
                                    Bordir Nama Dada (Opsional)
                                </h4>
                                <p className="text-[11px] text-amber-700 mt-0.5">Biaya Rp {namaDadaBasePrice.toLocaleString('id-ID')} / pcs (Diproses Inden Bordir)</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Nama Dada Putih */}
                            <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-amber-200">
                                <div>
                                    <div className="text-xs font-bold text-slate-800">Nama Dada Putih</div>
                                    <div className="text-[10px] text-slate-500">Seragam Putih / Pramuka</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setNamaDadaPutihQty(q => Math.max(0, q - 1))}
                                        className="w-7 h-7 rounded-lg bg-slate-100 font-bold text-slate-600 hover:bg-slate-200"
                                    >
                                        -
                                    </button>
                                    <span className="font-bold text-sm text-slate-800 w-6 text-center">{namaDadaPutihQty}</span>
                                    <button
                                        type="button"
                                        onClick={() => setNamaDadaPutihQty(q => q + 1)}
                                        className="w-7 h-7 rounded-lg bg-blue-100 font-bold text-blue-700 hover:bg-blue-200"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>

                            {/* Nama Dada Coklat */}
                            <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-amber-200">
                                <div>
                                    <div className="text-xs font-bold text-slate-800">Nama Dada Coklat</div>
                                    <div className="text-[10px] text-slate-500">Seragam Pramuka / Khusus</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setNamaDadaCoklatQty(q => Math.max(0, q - 1))}
                                        className="w-7 h-7 rounded-lg bg-slate-100 font-bold text-slate-600 hover:bg-slate-200"
                                    >
                                        -
                                    </button>
                                    <span className="font-bold text-sm text-slate-800 w-6 text-center">{namaDadaCoklatQty}</span>
                                    <button
                                        type="button"
                                        onClick={() => setNamaDadaCoklatQty(q => q + 1)}
                                        className="w-7 h-7 rounded-lg bg-blue-100 font-bold text-blue-700 hover:bg-blue-200"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Input SPMB (Paket) */}
            {form.type === 'SPMB' && (
                <div className="space-y-4">
                    <SelectField 
                        label="Tambah Paket Seragam *" 
                        value="" 
                        onChange={e => handleAddPackage(e.target.value)} 
                        disabled={!form.targetUnit}
                    >
                        <option value="">-- Tambah Paket --</option>
                        {packages
                            .filter(p => !form.targetUnit || p.targetUnit === form.targetUnit || !p.targetUnit || p.targetUnit === 'ALL')
                            .map(p => <option key={p.id} value={p.id}>{p.name} (Rp {p.price.toLocaleString('id-ID')})</option>)}
                    </SelectField>

                    {form.packages.map((pkg, pkgIndex) => (
                        <div key={pkgIndex} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 relative">
                            <button 
                                type="button" 
                                onClick={() => removePackage(pkgIndex)} 
                                className="absolute top-3 right-3 text-red-500 hover:text-red-700 bg-red-50 rounded p-1"
                            >
                                <X size={16} />
                            </button>
                            <div>
                                <label className="block text-sm font-bold text-blue-800">{pkg.name}</label>
                                <div className="text-xs text-slate-500">Harga Paket: Rp {pkg.price.toLocaleString('id-ID')} &bull; Total Dipesan: {pkg.qty || 0} Paket</div>
                            </div>
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 mt-2">
                                {[...new Set(pkg.items.map(i => i.size))].map(sizeName => {
                                    const sampleItem = pkg.items.find(i => i.size === sizeName);
                                    return (
                                        <div key={sizeName} className="flex items-center gap-2 bg-white border border-slate-200 rounded p-1.5 shadow-sm">
                                            <span className="text-xs font-bold text-slate-700 w-10 text-center">{sizeName}</span>
                                            <input 
                                                type="number" 
                                                min="0" 
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

            {/* Total Tagihan Box */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-2xl border border-blue-200 flex justify-between items-center">
                <div>
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Total Tagihan Pesanan</span>
                    <span className="text-xl font-black text-blue-800">Rp {form.totalAmount.toLocaleString('id-ID')}</span>
                </div>
                <div className="text-right text-xs text-slate-500">
                    <div>Status Pesanan: <strong className="text-amber-700">PENDING</strong></div>
                    <div>Pembayaran: <strong className="text-slate-700">{form.paymentMethod || 'TRANSFER'}</strong></div>
                </div>
            </div>

            {/* Tombol Simpan */}
            <div className="pt-2">
                <button 
                    type="submit"
                    disabled={
                        (form.type === 'RETAIL' && form.items.length === 0 && namaDadaPutihQty === 0 && namaDadaCoklatQty === 0) || 
                        (form.type === 'SPMB' && form.packages.length === 0)
                    }
                    className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition disabled:opacity-50 shadow-lg shadow-blue-500/20 text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                    <Save size={16} />
                    <span>Simpan & Buat Pesanan</span>
                </button>
            </div>
        </form>
    );
};
