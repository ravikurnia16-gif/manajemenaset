import React, { useState, useEffect } from 'react';
import { Plus, X, ShoppingCart, Info, CheckCircle2, Copy, Check, ArrowRight, RefreshCw, PhoneCall } from 'lucide-react';
import api from '../lib/axios';
import { useNavigate } from 'react-router-dom';

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

export default function UniformOrderPublic() {
    const navigate = useNavigate();
    const [units, setUnits] = useState([]);
    const [variants, setVariants] = useState([]);
    const [loading, setLoading] = useState(true);

    const [form, setForm] = useState({
        customerName: '', customerPhone: '', targetUnit: '', gender: '',
        subtotal: 0, totalAmount: 0, paymentMethod: 'TRANSFER', items: []
    });

    const [retailInput, setRetailInput] = useState({
        category: '', clothingType: '', size: '', qty: 1
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [namaDadaBasePrice, setNamaDadaBasePrice] = useState(15000);
    const [namaDadaPutihQty, setNamaDadaPutihQty] = useState(0);
    const [namaDadaCoklatQty, setNamaDadaCoklatQty] = useState(0);

    // State for order success screen (No direct invoice redirect)
    const [orderSuccess, setOrderSuccess] = useState(null);
    const [copiedCode, setCopiedCode] = useState(false);

    useEffect(() => {
        const fetchMasterData = async () => {
            try {
                const [uRes, vRes, ndRes] = await Promise.all([
                    api.get('/uniforms/public/units'),
                    api.get('/uniforms/public/variants'),
                    api.get('/uniforms/public/nama-dada-price').catch(() => ({ data: { price: 15000 } }))
                ]);
                setUnits(uRes.data);
                setVariants(vRes.data);
                if (ndRes && ndRes.data) setNamaDadaBasePrice(ndRes.data.price);
            } catch (err) {
                console.error(err);
                alert('Gagal memuat data seragam. Pastikan server berjalan.');
            } finally {
                setLoading(false);
            }
        };
        fetchMasterData();
    }, []);

    useEffect(() => {
        const itemsSubtotal = form.items.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);
        const subtotal = itemsSubtotal + ((namaDadaPutihQty + namaDadaCoklatQty) * namaDadaBasePrice);
        setForm(f => ({ ...f, subtotal, totalAmount: subtotal }));
    }, [form.items, namaDadaPutihQty, namaDadaCoklatQty, namaDadaBasePrice]);

    const availableVariants = form.targetUnit && form.gender
        ? variants.filter(v => {
            const unitName = v.item?.unit?.name || '';
            const isGeneralUnit = !v.item?.unit || unitName.toLowerCase() === 'umum' || unitName.toLowerCase() === 'semua unit';

            if (isGeneralUnit) {
                return v.item?.gender === form.gender || v.item?.gender === 'UMUM';
            }
            
            return unitName === form.targetUnit && 
                   (v.item.gender === form.gender || v.item.gender === 'UMUM');
        })
        : [];

    const availableCategories = [...new Set(availableVariants.map(v => v.item?.category?.name))].filter(Boolean);
    const availableClothingTypes = retailInput.category
        ? [...new Set(availableVariants.filter(v => v.item?.category?.name === retailInput.category).map(v => v.item?.clothingType?.name))].filter(Boolean)
        : [];

    let availableSizes = [];
    if (retailInput.clothingType === 'SEMUA_SETELAN') {
        availableSizes = [...new Set(availableVariants.filter(v => v.item?.category?.name === retailInput.category).map(v => v.size?.name || v.sizeName))].filter(Boolean);
    } else if (retailInput.clothingType) {
        availableSizes = [...new Set(availableVariants.filter(v => v.item?.category?.name === retailInput.category && v.item?.clothingType?.name === retailInput.clothingType).map(v => v.size?.name || v.sizeName))].filter(Boolean);
    }

    const addItem = () => {
        if (!retailInput.category || !retailInput.clothingType || !retailInput.size || retailInput.qty < 1) {
            alert('Mohon lengkapi pilihan kategori, jenis, ukuran, dan jumlah.');
            return;
        }

        const newItems = [...form.items];
        let targetVariants = [];

        if (retailInput.clothingType === 'SEMUA_SETELAN') {
            targetVariants = availableVariants.filter(v => v.item?.category?.name === retailInput.category && (v.size?.name || v.sizeName) === retailInput.size);
        } else {
            targetVariants = availableVariants.filter(v => v.item?.category?.name === retailInput.category && v.item?.clothingType?.name === retailInput.clothingType && (v.size?.name || v.sizeName) === retailInput.size);
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

    const getSizePriceStr = (sizeName) => {
        let targets = [];
        if (retailInput.clothingType === 'SEMUA_SETELAN') {
            targets = availableVariants.filter(v => v.item?.category?.name === retailInput.category && (v.size?.name || v.sizeName) === sizeName);
        } else {
            targets = availableVariants.filter(v => v.item?.category?.name === retailInput.category && v.item?.clothingType?.name === retailInput.clothingType && (v.size?.name || v.sizeName) === sizeName);
        }
        if (targets.length === 0) return '';
        const totalPrice = targets.reduce((sum, v) => {
            const price = (v.sellPrice !== null && v.sellPrice !== undefined) ? v.sellPrice : (v.item?.sellPrice || 0);
            return sum + price;
        }, 0);
        return ` - Rp ${totalPrice.toLocaleString('id-ID')}`;
    };

    const updateItemQty = (idx, qty) => {
        const newItems = [...form.items];
        newItems[idx].qty = parseInt(qty) || 1;
        setForm({ ...form, items: newItems });
    };

    const removeItem = (idx) => {
        setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });
    };

    const handleCopyCode = (code) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2500);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (form.items.length === 0) {
            return alert('Keranjang pesanan masih kosong.');
        }

        setIsSubmitting(true);
        try {
            const dataToSave = {
                type: 'RETAIL',
                status: 'PENDING',
                customerName: form.customerName,
                customerPhone: form.customerPhone,
                targetUnit: form.targetUnit,
                paymentMethod: 'TRANSFER',
                paidAmount: 0,
                discount: 0,
                items: form.items,
                note: ''
            };

            let notesArr = [];
            if (namaDadaPutihQty > 0) notesArr.push(`[NAMADADA_PUTIH:${namaDadaPutihQty}:${namaDadaBasePrice}:PENDING]`);
            if (namaDadaCoklatQty > 0) notesArr.push(`[NAMADADA_COKLAT:${namaDadaCoklatQty}:${namaDadaBasePrice}:PENDING]`);
            dataToSave.note = notesArr.join('\n');

            const res = await api.post('/uniforms/public/sales', dataToSave);
            
            // Show Success Screen instead of redirecting to invoice
            setOrderSuccess({
                code: res.data.code,
                customerName: form.customerName,
                customerPhone: form.customerPhone,
                targetUnit: form.targetUnit,
                totalAmount: form.totalAmount,
                items: form.items,
                namaDadaPutihQty,
                namaDadaCoklatQty,
                namaDadaBasePrice
            });
        } catch (err) {
            alert(err.response?.data?.error || 'Gagal menyimpan pesanan');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResetOrder = () => {
        setOrderSuccess(null);
        setForm({
            customerName: '', customerPhone: '', targetUnit: '', gender: '',
            subtotal: 0, totalAmount: 0, paymentMethod: 'TRANSFER', items: []
        });
        setNamaDadaPutihQty(0);
        setNamaDadaCoklatQty(0);
        setRetailInput({ category: '', clothingType: '', size: '', qty: 1 });
    };

    if (loading) return <div className="p-10 text-center font-bold text-slate-500">Memuat Form Pesanan...</div>;

    // ================= SUCCESS SCREEN (NO DIRECT INVOICE) =================
    if (orderSuccess) {
        return (
            <div className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans flex items-center justify-center">
                <div className="max-w-2xl w-full bg-white p-6 md:p-10 rounded-[2rem] shadow-xl border border-slate-100 space-y-6 text-center animate-in fade-in zoom-in-95 duration-300">
                    
                    {/* Success Badge */}
                    <div className="inline-flex items-center justify-center p-4 bg-emerald-100 text-emerald-600 rounded-full">
                        <CheckCircle2 size={48} className="text-emerald-600" />
                    </div>

                    <div className="space-y-1">
                        <h1 className="text-2xl md:text-3xl font-black text-slate-800">Alhamdulillah, Pesanan Diterima!</h1>
                        <p className="text-slate-500 text-sm">
                            Pesanan atas nama <strong className="text-slate-800">{orderSuccess.customerName}</strong> ({orderSuccess.targetUnit}) telah berhasil dicatat.
                        </p>
                    </div>

                    {/* Reference Code Box */}
                    <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="text-left">
                            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Kode Referensi Pesanan</div>
                            <div className="text-xl font-black text-blue-700 font-mono tracking-wide">{orderSuccess.code}</div>
                        </div>
                        <button
                            onClick={() => handleCopyCode(orderSuccess.code)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition border border-blue-200"
                        >
                            {copiedCode ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                            <span>{copiedCode ? 'Tersalin!' : 'Salin Kode'}</span>
                        </button>
                    </div>

                    {/* Summary of Items */}
                    <div className="bg-slate-50 rounded-2xl p-4 text-left space-y-2 border border-slate-100 text-xs">
                        <div className="font-bold text-slate-700 uppercase tracking-wider pb-1 border-b border-slate-200 flex justify-between">
                            <span>Rincian Item Dipesan</span>
                            <span className="font-black text-blue-700">Total: Rp {orderSuccess.totalAmount.toLocaleString('id-ID')}</span>
                        </div>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                            {orderSuccess.items.map((it, idx) => (
                                <div key={idx} className="flex justify-between items-center text-slate-600">
                                    <span>• {it.itemName}</span>
                                    <span className="font-semibold">{it.qty} pcs</span>
                                </div>
                            ))}
                            {orderSuccess.namaDadaPutihQty > 0 && (
                                <div className="flex justify-between items-center text-slate-600">
                                    <span>• Nama Dada (Putih)</span>
                                    <span className="font-semibold">{orderSuccess.namaDadaPutihQty} pcs</span>
                                </div>
                            )}
                            {orderSuccess.namaDadaCoklatQty > 0 && (
                                <div className="flex justify-between items-center text-slate-600">
                                    <span>• Nama Dada (Coklat)</span>
                                    <span className="font-semibold">{orderSuccess.namaDadaCoklatQty} pcs</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Notice Box about Next Step */}
                    <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-4 text-left space-y-2 text-xs text-blue-900">
                        <div className="font-bold flex items-center gap-1.5 text-blue-800 text-sm">
                            <Info size={16} className="text-blue-600 shrink-0" />
                            <span>Langkah Selanjutnya:</span>
                        </div>
                        <ol className="list-decimal list-inside space-y-1.5 text-blue-800/90 leading-relaxed">
                            <li>Pesanan Abu/Ummu saat ini berstatus <strong>Menunggu Konfirmasi Admin</strong> untuk pengecekan ketersediaan stok fisik di gudang.</li>
                            <li>Setelah seragam dipastikan <strong>Tersedia (Siap Diambil)</strong>, sistem akan mengirimkan <strong>Invoice Resmi</strong> beserta <strong>Informasi Pembayaran</strong> langsung ke nomor WhatsApp Abu/Ummu.</li>
                        </ol>
                    </div>

                    {/* Navigation Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <button
                            onClick={() => navigate('/public/lacak-pesanan')}
                            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-3.5 px-4 rounded-xl hover:bg-blue-700 transition shadow-sm"
                        >
                            <span>Lacak Status Pesanan</span>
                            <ArrowRight size={16} />
                        </button>
                        <button
                            onClick={handleResetOrder}
                            className="flex-1 flex items-center justify-center gap-2 bg-slate-100 text-slate-700 font-bold py-3.5 px-4 rounded-xl hover:bg-slate-200 transition border border-slate-200"
                        >
                            <Plus size={16} />
                            <span>Buat Pesanan Baru</span>
                        </button>
                    </div>

                </div>
            </div>
        );
    }

    // ================= ORDER FORM =================
    return (
        <div className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans">
            <div className="max-w-4xl mx-auto bg-white p-6 md:p-10 rounded-[2rem] shadow-xl border border-slate-100">

                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center p-4 bg-blue-100 text-blue-600 rounded-full mb-4">
                        <ShoppingCart size={32} />
                    </div>
                    <h1 className="text-3xl font-black text-slate-800">Form Pesanan Seragam</h1>
                    <p className="text-slate-500 mt-2">Pilih seragam sesuai dengan jenjang pendidikan dan gender siswa.</p>
                    <div className="mt-4">
                        <button onClick={() => navigate('/public/lacak-pesanan')} className="text-sm font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded-xl border border-blue-100 hover:bg-blue-100 transition-colors">
                            Cari & Lacak Pesanan Anda
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Identitas Siswa */}
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                        <h2 className="text-lg font-bold text-slate-800 border-b pb-2">1. Data Pemesan</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InputField label="Nama Siswa *" value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} required placeholder="Misal: Ahmad" />
                            <InputField label="No HP (WhatsApp) *" value={form.customerPhone} onChange={e => setForm({ ...form, customerPhone: e.target.value })} required placeholder="Misal: 08123456789" />
                            <SelectField label="Jenjang / Unit *" value={form.targetUnit} onChange={e => setForm({ ...form, targetUnit: e.target.value, items: [] })} required>
                                <option value="">-- Pilih Unit --</option>
                                {units.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                            </SelectField>
                            <SelectField label="Gender *" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value, items: [] })} required>
                                <option value="">-- Pilih Gender --</option>
                                <option value="IKHWAN">Ikhwan</option>
                                <option value="AKHWAT">Akhwat</option>
                            </SelectField>
                        </div>
                    </div>

                    {/* Input Pesanan */}
                    <div className="bg-white p-6 rounded-2xl border-2 border-blue-100 space-y-4">
                        <h2 className="text-lg font-bold text-slate-800 border-b pb-2">2. Pilih Seragam</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                            <SelectField label="Kategori Seragam" value={retailInput.category} onChange={e => setRetailInput({ ...retailInput, category: e.target.value, clothingType: '', size: '' })} disabled={!form.targetUnit || !form.gender}>
                                <option value="">-- Kategori --</option>
                                {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                            </SelectField>

                            <SelectField label="Jenis Pakaian" value={retailInput.clothingType} onChange={e => setRetailInput({ ...retailInput, clothingType: e.target.value, size: '' })} disabled={!retailInput.category}>
                                <option value="">-- Jenis --</option>
                                {availableClothingTypes.map(c => <option key={c} value={c}>{c}</option>)}
                                {(availableClothingTypes.length > 1 && !retailInput.category?.toLowerCase().includes('peci')) && (
                                    <option value="SEMUA_SETELAN" className="font-bold text-blue-600">Seragam Lengkap</option>
                                )}
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

                            <div className="flex items-end pt-1">
                                <button type="button" onClick={addItem} className="w-full h-[46px] flex items-center justify-center gap-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50" disabled={!retailInput.size}>
                                    <Plus size={18} /> Tambah
                                </button>
                            </div>
                        </div>

                        {retailInput.size && (
                            <div className="text-sm font-bold text-slate-700 bg-blue-50/50 p-3 rounded-xl border border-blue-100/50 inline-block">
                                Estimasi Harga Satuan: <span className="text-blue-600 text-lg font-black">{getSizePriceStr(retailInput.size).replace(' - ', '')}</span>
                            </div>
                        )}

                        {/* Keranjang */}
                        {form.items.length > 0 && (
                            <div className="mt-6 space-y-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase">Keranjang Pesanan</label>
                                {form.items.map((item, idx) => (
                                    <div key={idx} className="flex flex-wrap md:flex-nowrap items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                                        <div className="flex-1 text-sm font-bold text-slate-700">{item.itemName}</div>
                                        <div className="text-sm font-bold text-blue-600 md:w-32 md:text-right">Rp {item.unitPrice.toLocaleString()}</div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-500">Qty:</span>
                                            <input type="number" min="1" className="w-16 border border-slate-300 rounded-lg px-2 py-1 text-sm text-center font-bold" value={item.qty} onChange={e => updateItemQty(idx, e.target.value)} />
                                        </div>
                                        <button type="button" onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700 p-2 bg-red-50 rounded-lg ml-auto md:ml-0"><X size={18} /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Tambahan: Nama Dada */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
                        <h2 className="text-lg font-bold text-slate-800 border-b pb-2">3. Tambahan Atribut</h2>
                        
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex-1 flex items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <div>
                                    <div className="font-bold text-slate-800 text-sm">Nama Dada (Putih)</div>
                                    <div className="text-xs text-slate-500">Rp {namaDadaBasePrice.toLocaleString('id-ID')} / pcs</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Jml:</label>
                                    <input 
                                        type="number" 
                                        min="0" 
                                        className="w-16 border border-slate-300 rounded-lg px-2 py-2 text-center font-bold outline-none focus:ring-2 focus:ring-blue-500" 
                                        value={namaDadaPutihQty} 
                                        onChange={e => setNamaDadaPutihQty(parseInt(e.target.value) || 0)} 
                                    />
                                </div>
                            </div>
                            
                            <div className="flex-1 flex items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <div>
                                    <div className="font-bold text-slate-800 text-sm">Nama Dada (Coklat)</div>
                                    <div className="text-xs text-slate-500">Rp {namaDadaBasePrice.toLocaleString('id-ID')} / pcs</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Jml:</label>
                                    <input 
                                        type="number" 
                                        min="0" 
                                        className="w-16 border border-slate-300 rounded-lg px-2 py-2 text-center font-bold outline-none focus:ring-2 focus:ring-blue-500" 
                                        value={namaDadaCoklatQty} 
                                        onChange={e => setNamaDadaCoklatQty(parseInt(e.target.value) || 0)} 
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Ringkasan & Submit Pesanan */}
                    <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 space-y-6">
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div>
                                <div className="text-xs font-bold text-blue-900 uppercase tracking-wider">Status Pemesanan</div>
                                <div className="text-sm text-blue-700 font-semibold mt-0.5">Pre-Order / Menunggu Konfirmasi Stok</div>
                            </div>
                            <div className="text-right w-full sm:w-auto">
                                <div className="text-xs text-slate-500 font-bold mb-0.5">Total Estimasi Tagihan</div>
                                <div className="text-3xl md:text-4xl font-black text-blue-700">Rp {form.totalAmount.toLocaleString()}</div>
                            </div>
                        </div>

                        <div className="bg-blue-100/60 p-4 rounded-xl flex gap-3 items-start text-xs text-blue-900 leading-relaxed border border-blue-200/60">
                            <Info size={18} className="shrink-0 mt-0.5 text-blue-700" />
                            <div>
                                Setelah Anda membuat pesanan, Admin kami akan memeriksa ketersediaan stok seragam terlebih dahulu. Invoice resmi beserta informasi pembayaran akan dikirimkan otomatis ke WhatsApp Anda begitu seragam telah siap / tersedia.
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={form.items.length === 0 || isSubmitting}
                            className="w-full bg-blue-600 text-white font-black text-lg py-4 rounded-xl hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200 transition-all disabled:opacity-50 disabled:grayscale"
                        >
                            {isSubmitting ? 'MEMPROSES PESANAN...' : 'BUAT PESANAN SEKARANG'}
                        </button>
                    </div>
                </form>

            </div>
        </div>
    );
}
