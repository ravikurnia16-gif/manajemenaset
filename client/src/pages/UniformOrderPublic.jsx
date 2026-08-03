import { useState, useEffect } from 'react';
import { Plus, X, ShoppingCart, Info } from 'lucide-react';
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
        subtotal: 0, totalAmount: 0, paymentMethod: 'CASH', items: []
    });

    const [retailInput, setRetailInput] = useState({
        category: '', clothingType: '', size: '', qty: 1
    });

    useEffect(() => {
        const fetchMasterData = async () => {
            try {
                const [uRes, vRes] = await Promise.all([
                    api.get('/uniforms/public/units'),
                    api.get('/uniforms/public/variants')
                ]);
                setUnits(uRes.data);
                setVariants(vRes.data);
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
        const subtotal = form.items.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);
        setForm(f => ({ ...f, subtotal, totalAmount: subtotal }));
    }, [form.items]);

    const availableVariants = form.targetUnit && form.gender
        ? variants.filter(v => v.item?.unit?.name === form.targetUnit && v.item?.gender === form.gender)
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
                unitPrice: v.item?.sellPrice || 0
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (form.items.length === 0) {
            return alert('Keranjang pesanan masih kosong.');
        }

        try {
            const dataToSave = {
                type: 'RETAIL',
                status: 'PENDING',
                customerName: form.customerName,
                customerPhone: form.customerPhone,
                targetUnit: form.targetUnit,
                paymentMethod: form.paymentMethod,
                paidAmount: 0,
                discount: 0,
                items: form.items
            };

            const res = await api.post('/uniforms/public/sales', dataToSave);
            // Redirect to invoice page
            navigate(`/public/invoice-seragam/${res.data.id}`);
        } catch (err) {
            alert(err.response?.data?.error || 'Gagal menyimpan pesanan');
        }
    };

    if (loading) return <div className="p-10 text-center font-bold text-slate-500">Memuat Form Pesanan...</div>;

    return (
        <div className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans">
            <div className="max-w-4xl mx-auto bg-white p-6 md:p-10 rounded-[2rem] shadow-xl border border-slate-100">

                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center p-4 bg-blue-100 text-blue-600 rounded-full mb-4">
                        <ShoppingCart size={32} />
                    </div>
                    <h1 className="text-3xl font-black text-slate-800">Form Pesanan Seragam</h1>
                    <p className="text-slate-500 mt-2">Pilih seragam sesuai dengan jenjang pendidikan dan gender siswa.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Identitas Siswa */}
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                        <h2 className="text-lg font-bold text-slate-800 border-b pb-2">1. Data Pemesan</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                {availableClothingTypes.length > 1 && <option value="SEMUA_SETELAN" className="font-bold text-blue-600">Seragam Lengkap</option>}
                            </SelectField>

                            <SelectField label="Ukuran" value={retailInput.size} onChange={e => setRetailInput({ ...retailInput, size: e.target.value })} disabled={!retailInput.clothingType}>
                                <option value="">-- Ukuran --</option>
                                {availableSizes.map(s => <option key={s} value={s}>{s}</option>)}
                            </SelectField>

                            <InputField type="number" min="1" label="Jumlah" value={retailInput.qty} onChange={e => setRetailInput({ ...retailInput, qty: e.target.value })} disabled={!retailInput.size} />

                            <div className="flex items-end pt-1">
                                <button type="button" onClick={addItem} className="w-full h-[46px] flex items-center justify-center gap-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50" disabled={!retailInput.size}>
                                    <Plus size={18} /> Tambah
                                </button>
                            </div>
                        </div>

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

                    {/* Pembayaran & Submit */}
                    <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 space-y-6">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="w-full md:w-1/2">
                                <SelectField label="Rencana Metode Pembayaran" value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })}>
                                    <option value="CASH">Tunai</option>
                                    <option value="TRANSFER">Transfer Bank (7311412188 an Syafrian, BSI)</option>
                                </SelectField>
                            </div>
                            <div className="text-right w-full md:w-1/2">
                                <div className="text-sm text-slate-500 font-bold mb-1">Total Tagihan</div>
                                <div className="text-3xl md:text-4xl font-black text-blue-700">Rp {form.totalAmount.toLocaleString()}</div>
                            </div>
                        </div>

                        <div className="bg-blue-100/50 p-4 rounded-xl flex gap-3 items-start text-sm text-blue-800">
                            <Info size={20} className="shrink-0 mt-0.5 text-blue-600" />
                            <div>Pesanan ini bersifat Pre-Order / Backorder (Belum Diambil). Silakan simpan invoice yang muncul setelah ini untuk diserahkan ke bagian admin aset sekolah saat pengambilan barang.</div>
                        </div>

                        <button
                            type="submit"
                            disabled={form.items.length === 0}
                            className="w-full bg-blue-600 text-white font-black text-lg py-4 rounded-xl hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200 transition-all disabled:opacity-50 disabled:grayscale"
                        >
                            BUAT PESANAN SEKARANG
                        </button>
                    </div>
                </form>

            </div>
        </div>
    );
}
