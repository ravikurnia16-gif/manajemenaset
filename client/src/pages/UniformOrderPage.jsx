import { useState, useEffect } from 'react';
import { ShoppingBag, Search, Plus, Trash2, Save, Loader2, Check, User } from 'lucide-react';
import SearchableSelect from '../components/SearchableSelect';

const USERS_UNITS = ['TK', 'TAUD', 'SD', 'SMP', 'SMA', 'Pondok Putra', 'Pondok Putri', 'MIT', 'Yayasan'];

const UniformOrderPage = () => {
    const [selectedUnit, setSelectedUnit] = useState('');
    const [items, setItems] = useState([]);
    const [cart, setCart] = useState([]);

    // Form Data
    const [form, setForm] = useState({ customerName: '', customerPhone: '', studentName: '', studentClass: '', note: '' });

    // Item Input State
    const [selectedItemId, setSelectedItemId] = useState(null);
    const [inputQty, setInputQty] = useState(1);

    const [loading, setLoading] = useState(false);
    const [orderResult, setOrderResult] = useState(null);

    // Check Order State
    const [checkCode, setCheckCode] = useState('');
    const [checkPhone, setCheckPhone] = useState('');
    const [checkResult, setCheckResult] = useState(null);
    const [showCheck, setShowCheck] = useState(false);

    const API_BASE = window.location.origin.includes('localhost') ? 'http://localhost:5000' : '';

    // Fetch items when Unit is selected
    useEffect(() => {
        if (selectedUnit) {
            setLoading(true);
            fetch(`${API_BASE}/api/uniform-order/items?unit=${encodeURIComponent(selectedUnit)}`)
                .then(r => r.json())
                .then(d => {
                    setItems(d.items || []);
                    setCart([]); // Reset cart on unit change
                    setSelectedItemId(null);
                })
                .catch(() => setItems([]))
                .finally(() => setLoading(false));
        } else {
            setItems([]);
        }
    }, [selectedUnit]);

    // Prepare options for Select
    const itemOptions = items.map(i => ({
        id: i.id,
        name: `${i.name} (${i.size || '-'}) - Rp ${(i.purchasePrice || 0).toLocaleString('id-ID')} [Stok: ${i.stock}]`
    }));

    const handleAddItem = () => {
        if (!selectedItemId) return alert('Pilih barang terlebih dahulu');
        if (inputQty <= 0) return alert('Jumlah minimal 1');

        const item = items.find(i => i.id == selectedItemId);
        if (!item) return;

        const existing = cart.find(c => c.itemId === item.id);
        if (existing) {
            setCart(cart.map(c => c.itemId === item.id ? { ...c, quantity: c.quantity + inputQty } : c));
        } else {
            setCart([...cart, { itemId: item.id, quantity: inputQty, item }]);
        }

        // Reset item input
        setSelectedItemId(null);
        setInputQty(1);
    };

    const handleRemoveItem = (itemId) => {
        setCart(cart.filter(c => c.itemId !== itemId));
    };

    const totalAmount = cart.reduce((sum, c) => sum + (c.item.purchasePrice || 0) * c.quantity, 0);

    const handleSubmit = async () => {
        if (!selectedUnit) return alert('Pilih Unit Sekolah');
        if (!form.customerName || !form.customerPhone || !form.studentName) return alert('Lengkapi Data Pemesan (Nama Siswa, Ortu, HP)');
        if (cart.length === 0) return alert('Belum ada barang yang dipilih');

        if (!confirm('Apakah data sudah benar? Pesanan akan dikirim.')) return;

        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/uniform-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, customerUnit: selectedUnit, items: cart.map(c => ({ itemId: c.itemId, quantity: c.quantity })) })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setOrderResult(data.order);
        } catch (e) { alert(e.message); } finally { setLoading(false); }
    };

    const handleCheckOrder = async () => {
        if (!checkCode) return alert('Masukkan kode');
        try {
            const res = await fetch(`${API_BASE}/api/uniform-order/check/${checkCode}?phone=${checkPhone}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setCheckResult(data);
        } catch (e) { alert(e.message); }
    };

    // --- SUCCESS VIEW ---
    if (orderResult) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white max-w-md w-full rounded-xl shadow-lg p-8 text-center space-y-6">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto"><Check size={40} className="text-green-600" /></div>
                    <h2 className="text-2xl font-bold text-green-700">Pesanan Berhasil!</h2>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <div className="text-sm text-slate-500">Kode Pesanan</div>
                        <div className="text-3xl font-mono font-bold text-slate-800">{orderResult.code}</div>
                    </div>
                    <p className="text-sm text-slate-500">Simpan kode ini untuk cek status.</p>
                    <button onClick={() => window.location.reload()} className="bg-indigo-600 text-white w-full py-3 rounded-lg font-bold">Pesan Lagi</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Header */}
            <div className="bg-indigo-600 text-white p-4 sticky top-0 z-50 shadow-md flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <ShoppingBag size={24} />
                    <div>
                        <h1 className="font-bold text-lg leading-tight">Form Pesan Seragam</h1>
                        <p className="text-xs text-indigo-200">Input Data & Pilih Barang</p>
                    </div>
                </div>
                <button onClick={() => setShowCheck(!showCheck)} className="text-xs bg-white/20 px-3 py-1.5 rounded flex items-center gap-1 hover:bg-white/30 transition">
                    <Search size={14} /> Cek Status
                </button>
            </div>

            {/* Check Modal */}
            {showCheck && (
                <div className="p-4 bg-white border-b-4 border-indigo-100 space-y-3 animate-in fade-in">
                    <h3 className="font-bold text-sm text-slate-700">Cek Status Pesanan</h3>
                    <div className="flex gap-2">
                        <input value={checkCode} onChange={e => setCheckCode(e.target.value.toUpperCase())} placeholder="Kode (ORD/...)" className="border p-2 rounded w-1/2 text-sm" />
                        <input value={checkPhone} onChange={e => setCheckPhone(e.target.value)} placeholder="No HP" className="border p-2 rounded w-1/2 text-sm" />
                    </div>
                    <button onClick={handleCheckOrder} className="bg-slate-800 text-white w-full py-2 rounded text-sm font-bold">Cek Status</button>
                    {checkResult && (
                        <div className="bg-slate-100 p-3 rounded text-sm mt-2 border border-slate-200">
                            <div className="flex justify-between font-bold text-slate-800">
                                <span>{checkResult.code}</span>
                                <span className="bg-white px-2 rounded text-xs border border-slate-300">{checkResult.status}</span>
                            </div>
                            <div className="text-slate-600 mt-1">{checkResult.studentName}</div>
                            <ul className="list-disc pl-4 mt-2 text-xs text-slate-500">
                                {checkResult.items?.map((i, idx) => <li key={idx}>{i.item.name} x{i.quantity}</li>)}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            <div className="max-w-4xl mx-auto p-4 space-y-6">

                {/* 1. DATA PEMESAN */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2">
                        <User size={18} className="text-indigo-600" /> Data Pemesan
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Unit Selection */}
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Unit Sekolah *</label>
                            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                {USERS_UNITS.map(u => (
                                    <button key={u} onClick={() => setSelectedUnit(u)}
                                        className={`px-2 py-2 text-sm rounded border transition ${selectedUnit === u ? 'bg-indigo-600 text-white border-indigo-600 font-bold' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
                                        {u}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nama Siswa *</label>
                            <input className="w-full border border-slate-300 p-2.5 rounded-lg text-sm focus:border-indigo-500 outline-none"
                                value={form.studentName} onChange={e => setForm({ ...form, studentName: e.target.value })} placeholder="Nama Lengkap" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Kelas</label>
                            <input className="w-full border border-slate-300 p-2.5 rounded-lg text-sm focus:border-indigo-500 outline-none"
                                value={form.studentClass} onChange={e => setForm({ ...form, studentClass: e.target.value })} placeholder="Contoh: 1A" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nama Orang Tua *</label>
                            <input className="w-full border border-slate-300 p-2.5 rounded-lg text-sm focus:border-indigo-500 outline-none"
                                value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} placeholder="Nama Wali" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">No HP / WA *</label>
                            <input className="w-full border border-slate-300 p-2.5 rounded-lg text-sm focus:border-indigo-500 outline-none"
                                value={form.customerPhone} onChange={e => setForm({ ...form, customerPhone: e.target.value })} placeholder="08xxxxxxxx" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Catatan Tambahan</label>
                            <input className="w-full border border-slate-300 p-2.5 rounded-lg text-sm focus:border-indigo-500 outline-none"
                                value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Opsional" />
                        </div>
                    </div>
                </div>

                {/* 2. INPUT BARANG */}
                <div className={`bg-white p-5 rounded-xl shadow-sm border border-slate-200 transition-opacity ${!selectedUnit ? 'opacity-50 pointer-events-none' : ''}`}>
                    <h2 className="font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2">
                        <Plus size={18} className="text-indigo-600" /> Tambah Barang
                    </h2>

                    <div className="flex flex-col md:flex-row gap-3 items-end">
                        <div className="flex-1 w-full">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Pilih Seragam</label>
                            <SearchableSelect
                                options={itemOptions}
                                value={selectedItemId}
                                onChange={setSelectedItemId}
                                placeholder={loading ? "Memuat data..." : "Ketik nama barang / ukuran..."}
                                disabled={!selectedUnit}
                            />
                        </div>
                        <div className="w-24">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Jumlah</label>
                            <input type="number" min="1" className="w-full border border-slate-300 p-2.5 rounded-lg text-sm font-bold text-center outline-none focus:border-indigo-500"
                                value={inputQty} onChange={e => setInputQty(parseInt(e.target.value) || 0)} />
                        </div>
                        <button onClick={handleAddItem} className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-bold text-sm hover:bg-indigo-700 transition flex items-center gap-2 h-[42px]">
                            <Plus size={18} /> Tambah
                        </button>
                    </div>
                    {!selectedUnit && <p className="text-xs text-red-500 mt-2">* Pilih Unit Sekolah terlebih dahulu di atas.</p>}
                </div>

                {/* 3. TABEL PESANAN */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                        <h2 className="font-bold text-slate-800 flex items-center gap-2">
                            <ShoppingBag size={18} className="text-indigo-600" /> Daftar Pesanan
                        </h2>
                        <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">{cart.length} Item</span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100 text-slate-500 uppercase text-xs font-bold">
                                <tr>
                                    <th className="px-4 py-3">Nama Barang</th>
                                    <th className="px-4 py-3">Ukuran</th>
                                    <th className="px-4 py-3 text-right">Harga</th>
                                    <th className="px-4 py-3 text-center">Qty</th>
                                    <th className="px-4 py-3 text-right">Subtotal</th>
                                    <th className="px-4 py-3 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {cart.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="px-4 py-8 text-center text-slate-400 italic">Belum ada barang yang dipilih.</td>
                                    </tr>
                                ) : (
                                    cart.map((c, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 font-medium text-slate-700">{c.item.name}</td>
                                            <td className="px-4 py-3 text-slate-500">{c.item.size || '-'}</td>
                                            <td className="px-4 py-3 text-right text-slate-600">Rp {(c.item.purchasePrice || 0).toLocaleString('id-ID')}</td>
                                            <td className="px-4 py-3 text-center font-bold">{c.quantity}</td>
                                            <td className="px-4 py-3 text-right font-bold text-indigo-600">Rp {((c.item.purchasePrice || 0) * c.quantity).toLocaleString('id-ID')}</td>
                                            <td className="px-4 py-3 text-center">
                                                <button onClick={() => handleRemoveItem(c.itemId)} className="text-red-500 hover:text-red-700 bg-red-50 p-1.5 rounded-md transition"><Trash2 size={16} /></button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            {cart.length > 0 && (
                                <tfoot className="bg-slate-50 font-bold text-slate-800">
                                    <tr>
                                        <td colSpan="4" className="px-4 py-3 text-right uppercase text-xs text-slate-500 pt-4">Total Estimasi</td>
                                        <td className="px-4 py-3 text-right text-lg text-indigo-700 pt-4">Rp {totalAmount.toLocaleString('id-ID')}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>

                    {/* Submit Button */}
                    <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                        <button onClick={handleSubmit} disabled={loading || cart.length === 0}
                            className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-bold shadow-lg transition flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                            {loading ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                            Kirim Pesanan Sekarang
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default UniformOrderPage;
