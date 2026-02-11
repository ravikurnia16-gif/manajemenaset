import { useState, useEffect, useMemo } from 'react';
import { ShoppingBag, Search, Plus, Trash2, Save, Loader2, Check, User } from 'lucide-react';

const USERS_UNITS = ['TK', 'TAUD', 'SD', 'SMP', 'SMA', 'Pondok Putra', 'Pondok Putri', 'MIT', 'Yayasan'];

// Configuration based on User Request
const GROUPS = ['Nasional', 'Pramuka', 'Muslim', 'Batik', 'Jubah', 'Olahraga', 'Lainnya'];
const SUB_TYPES = [
    'Baju',
    'Celana',
    'Rok',
    'Jilbab',
    'Stel (Baju & Celana/Rok)',
    'Jubah Putih',
    'Jubah Hitam',
    'Set Olahraga Akhwat (Baju+Rok+Jilbab)'
];

const SIZES_STD = ['SS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const SIZES_JUBAH = ['38', '40', '42', '44', '46', '48', '50/20', '50/22', '50/24', '52/20', '52/22', '52/24', '54/20', '54/22', '54/24'];
const SIZES_PECI = ['20', '20.5', '21', '21.5', '22', '22.5', '23', '23.5', '24'];

const UniformOrderPage = () => {
    // 1. Unit & Items
    const [selectedUnit, setSelectedUnit] = useState('');
    const [items, setItems] = useState([]);

    // 2. Data Pemesan
    const [form, setForm] = useState({
        studentName: '',
        customerPhone: '',
        customerName: '', // Ortu
        studentClass: '',
        note: ''
    });

    // 3. Filters / Item Selection
    const [gender, setGender] = useState('L'); // Default L (Ikhwan) as per common use
    const [mainType, setMainType] = useState('Seragam'); // 'Seragam' or 'Peci'

    // Seragam Specific
    const [selectedGroup, setSelectedGroup] = useState('');
    const [selectedSubType, setSelectedSubType] = useState('');
    const [selectedSize, setSelectedSize] = useState('');

    const [inputQty, setInputQty] = useState(1);
    const [cart, setCart] = useState([]);

    // System State
    const [loading, setLoading] = useState(false);
    const [orderResult, setOrderResult] = useState(null);
    const [checkCode, setCheckCode] = useState('');
    const [checkPhone, setCheckPhone] = useState('');
    const [checkResult, setCheckResult] = useState(null);
    const [showCheck, setShowCheck] = useState(false);

    const API_BASE = window.location.origin.includes('localhost') ? 'http://localhost:5000' : '';

    // Fetch items
    useEffect(() => {
        if (selectedUnit) {
            setLoading(true);
            fetch(`${API_BASE}/api/uniform-order/items?unit=${encodeURIComponent(selectedUnit)}`)
                .then(r => r.json())
                .then(d => {
                    setItems(d.items || []);
                    setCart([]);
                })
                .catch(() => setItems([]))
                .finally(() => setLoading(false));
        } else {
            setItems([]);
        }
    }, [selectedUnit]);

    // Matching Logic to find the specific Item
    const matchedItem = useMemo(() => {
        if (!selectedUnit) return null;
        if (mainType === 'Peci') {
            if (!selectedSize) return null;
            // Find item with "Peci" and Size
            return items.find(i =>
                (i.name.toLowerCase().includes('peci') || i.name.toLowerCase().includes('songkok') || i.category?.name?.toLowerCase().includes('peci')) &&
                i.size === selectedSize
            );
        } else {
            // Seragam
            if (!selectedGroup || !selectedSubType || !selectedSize) return null;

            return items.find(i => {
                const name = i.name.toLowerCase();
                const genderMatch = i.gender === gender; // Strict gender match?
                // Group Match
                const groupMatch = name.includes(selectedGroup.toLowerCase()) || (i.uniformGroup && i.uniformGroup === selectedGroup);
                // Type Match
                let typeMatch = false;
                if (selectedSubType === 'Jubah Putih') typeMatch = name.includes('putih');
                else if (selectedSubType === 'Jubah Hitam') typeMatch = name.includes('hitam');
                else if (selectedSubType.includes('Set Olahraga')) typeMatch = name.includes('set') && name.includes('olahraga');
                else if (selectedSubType === 'Stel') typeMatch = name.includes('stel') || (name.includes('baju') && name.includes('celana'));
                else typeMatch = name.includes(selectedSubType.toLowerCase());

                // Size Match
                const sizeMatch = i.size === selectedSize;

                return genderMatch && groupMatch && typeMatch && sizeMatch;
            });
        }
    }, [items, mainType, gender, selectedGroup, selectedSubType, selectedSize, selectedUnit]);

    const handleAddItem = () => {
        if (!matchedItem) {
            return alert('Item tidak ditemukan di database untuk kombinasi ini. Coba cek kembali filter Anda.');
        }

        const existing = cart.find(c => c.itemId === matchedItem.id);
        if (existing) {
            setCart(cart.map(c => c.itemId === matchedItem.id ? { ...c, quantity: c.quantity + inputQty } : c));
        } else {
            setCart([...cart, { itemId: matchedItem.id, quantity: inputQty, item: matchedItem }]);
        }
    };

    const handleRemoveItem = (itemId) => {
        setCart(cart.filter(c => c.itemId !== itemId));
    };

    const handleSubmit = async () => {
        if (!selectedUnit) return alert('Pilih Unit Sekolah');
        if (!form.studentName || !form.customerPhone) return alert('Nama Anak dan No HP wajib diisi');
        if (cart.length === 0) return alert('Belum ada pesanan');

        if (!confirm('Kirim pesanan ini?')) return;

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
                    <button onClick={() => window.location.reload()} className="bg-indigo-600 text-white w-full py-3 rounded-lg font-bold">Buat Pesanan Baru</button>
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

            <div className="max-w-3xl mx-auto p-4 space-y-6">

                {/* 1. Unit & Data Diri */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2"><User size={18} /> Data Pemesan</h2>

                    <div className="space-y-4">
                        {/* Unit */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">1. Unit Sekolah *</label>
                            <div className="flex flex-wrap gap-2">
                                {USERS_UNITS.map(u => (
                                    <button key={u} onClick={() => setSelectedUnit(u)}
                                        className={`px-3 py-2 text-sm rounded border transition ${selectedUnit === u ? 'bg-indigo-600 text-white border-indigo-600 font-bold' : 'bg-white text-slate-600 border-slate-300'}`}>
                                        {u}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Inputs */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">2. Nama Anak *</label>
                                <input className="w-full border p-2 rounded text-sm" value={form.studentName} onChange={e => setForm({ ...form, studentName: e.target.value })} placeholder="Nama Lengkap Siswa" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">3. No HP (WA) *</label>
                                <input className="w-full border p-2 rounded text-sm" value={form.customerPhone} onChange={e => setForm({ ...form, customerPhone: e.target.value })} placeholder="08xxxxxxxx" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nama Orang Tua</label>
                                <input className="w-full border p-2 rounded text-sm" value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} placeholder="Opsional" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Kelas</label>
                                <input className="w-full border p-2 rounded text-sm" value={form.studentClass} onChange={e => setForm({ ...form, studentClass: e.target.value })} placeholder="Contoh: 1A" />
                            </div>
                        </div>

                        {/* Gender */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">4. Jenis Kelamin *</label>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer border p-3 rounded-lg w-full md:w-auto hover:bg-slate-50">
                                    <input type="radio" name="gender" checked={gender === 'L'} onChange={() => setGender('L')} className="w-4 h-4 text-indigo-600" />
                                    <span className="font-bold text-slate-700">Ikhwan (Laki-laki)</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer border p-3 rounded-lg w-full md:w-auto hover:bg-slate-50">
                                    <input type="radio" name="gender" checked={gender === 'P'} onChange={() => setGender('P')} className="w-4 h-4 text-pink-600" />
                                    <span className="font-bold text-slate-700">Akhwat (Perempuan)</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Pilih Produk */}
                <div className={`bg-white p-5 rounded-xl shadow-sm border border-slate-200 transition-opacity ${!selectedUnit ? 'opacity-50 pointer-events-none' : ''}`}>
                    <h2 className="font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2"><Plus size={18} /> Pilih Seragam / Peci</h2>

                    {/* 5. Jenis (Seragam / Peci) */}
                    <div className="mb-4">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">5. Jenis Item</label>
                        <div className="flex gap-2">
                            <button onClick={() => setMainType('Seragam')} className={`flex-1 py-2 text-sm rounded border font-bold ${mainType === 'Seragam' ? 'bg-slate-800 text-white border-slate-800' : 'text-slate-600 border-slate-300'}`}>
                                Seragam
                            </button>
                            <button onClick={() => setMainType('Peci')} className={`flex-1 py-2 text-sm rounded border font-bold ${mainType === 'Peci' ? 'bg-slate-800 text-white border-slate-800' : 'text-slate-600 border-slate-300'}`}>
                                Peci
                            </button>
                        </div>
                    </div>

                    {/* Cascading Dropdowns */}
                    <div className="bg-slate-50 p-4 rounded-lg space-y-4">
                        {mainType === 'Seragam' && (
                            <>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Kategori Seragam</label>
                                    <select className="w-full border p-2 rounded text-sm" value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}>
                                        <option value="">-- Pilih Kategori --</option>
                                        {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Tipe / Model</label>
                                    <select className="w-full border p-2 rounded text-sm" value={selectedSubType} onChange={e => setSelectedSubType(e.target.value)}>
                                        <option value="">-- Pilih Tipe --</option>
                                        {SUB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Ukuran</label>
                                    <select className="w-full border p-2 rounded text-sm" value={selectedSize} onChange={e => setSelectedSize(e.target.value)}>
                                        <option value="">-- Pilih Ukuran --</option>
                                        {(selectedGroup === 'Jubah' ? SIZES_JUBAH : SIZES_STD).map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </>
                        )}

                        {mainType === 'Peci' && (
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Ukuran Peci</label>
                                <select className="w-full border p-2 rounded text-sm" value={selectedSize} onChange={e => setSelectedSize(e.target.value)}>
                                    <option value="">-- Pilih Ukuran --</option>
                                    {SIZES_PECI.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        )}

                        <div className="flex items-end gap-3 mt-4 pt-4 border-t border-slate-200">
                            <div className="w-24">
                                <label className="block text-xs font-bold text-slate-500 mb-1">Jumlah</label>
                                <input type="number" min="1" className="w-full border p-2 rounded text-sm text-center font-bold" value={inputQty} onChange={e => setInputQty(parseInt(e.target.value) || 1)} />
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-slate-500 mb-1">Status Ketersediaan</label>
                                <div className={`p-2 rounded text-sm font-bold border ${matchedItem ? (matchedItem.stock > 0 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-orange-50 text-orange-700 border-orange-200') : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                                    {matchedItem ? (matchedItem.stock > 0 ? `Ready (Stok: ${matchedItem.stock})` : 'Pre-Order (Stok Habis)') : 'Item tidak ditemukan / Filter belum lengkap'}
                                </div>
                            </div>
                        </div>
                        {matchedItem && (
                            <div className="text-right text-sm font-bold text-indigo-600">
                                Harga: Rp {(matchedItem.purchasePrice || 0).toLocaleString('id-ID')}
                            </div>
                        )}
                        <button onClick={handleAddItem} className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 transition flex items-center justify-center gap-2 mt-2">
                            <Plus size={18} /> Tambahkan ke Pesanan
                        </button>
                    </div>
                </div>

                {/* 3. List Cart */}
                {cart.length > 0 && (
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                        <h2 className="font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2"><ShoppingBag size={18} /> Daftar Pesanan</h2>
                        <ul className="space-y-3 mb-4">
                            {cart.map((c, i) => (
                                <li key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                                    <div>
                                        <div className="font-bold text-slate-700 text-sm">{c.item.name}</div>
                                        <div className="text-xs text-slate-500">Ukuran: {c.item.size} • Qty: {c.quantity}</div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="font-bold text-slate-600 text-sm">Rp {((c.item.purchasePrice || 0) * c.quantity).toLocaleString('id-ID')}</span>
                                        <button onClick={() => setCart(cart.filter(x => x.itemId !== c.itemId))} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                        <div className="flex justify-between items-center bg-indigo-50 p-3 rounded-lg border border-indigo-100 mb-4">
                            <span className="font-bold text-indigo-800">Total Estimasi</span>
                            <span className="font-bold text-xl text-indigo-700">Rp {cart.reduce((s, c) => s + ((c.item.purchasePrice || 0) * c.quantity), 0).toLocaleString('id-ID')}</span>
                        </div>
                        <button onClick={handleSubmit} disabled={loading} className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-bold shadow-lg flex justify-center items-center gap-2">
                            {loading ? <Loader2 className="animate-spin" /> : <Save />} Kirim Pesanan
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UniformOrderPage;
