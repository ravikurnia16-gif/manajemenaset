import { useState, useEffect } from 'react';
import { ShoppingBag, ChevronRight, ChevronLeft, Check, User, Phone, School, Search, Minus, Plus, Loader2, Filter } from 'lucide-react';

const UNIFORM_GROUPS = ['Nasional', 'Batik', 'Muslim', 'Pramuka', 'Olahraga', 'Jubah Hitam', 'Jubah Putih', 'Lainnya'];
const USERS_UNITS = ['TK', 'TAUD', 'SD', 'SMP', 'SMA', 'Pondok Putra', 'Pondok Putri', 'MIT', 'Yayasan'];

const UniformOrderPage = () => {
    const [step, setStep] = useState(1);
    const [selectedUnit, setSelectedUnit] = useState('');
    const [items, setItems] = useState([]);
    const [cart, setCart] = useState([]);

    // Filter States
    const [filterGender, setFilterGender] = useState('');
    const [filterGroup, setFilterGroup] = useState('');

    const [form, setForm] = useState({ customerName: '', customerPhone: '', studentName: '', studentClass: '', note: '' });
    const [loading, setLoading] = useState(false);
    const [orderResult, setOrderResult] = useState(null);
    const [checkCode, setCheckCode] = useState('');
    const [checkPhone, setCheckPhone] = useState('');
    const [checkResult, setCheckResult] = useState(null);
    const [showCheck, setShowCheck] = useState(false);

    const API_BASE = window.location.origin.includes('localhost') ? 'http://localhost:5000' : '';

    useEffect(() => {
        if (selectedUnit) {
            setLoading(true);
            fetch(`${API_BASE}/api/uniform-order/items?unit=${encodeURIComponent(selectedUnit)}`)
                .then(r => r.json())
                .then(d => {
                    setItems(d.items || []);
                    setFilterGender('');
                    setFilterGroup('');
                    setCart([]);
                })
                .catch(() => setItems([]))
                .finally(() => setLoading(false));
        }
    }, [selectedUnit]);

    const filteredItems = items.filter(i => {
        if (filterGender) {
            const genderCode = filterGender === 'Ikhwan' ? 'L' : 'P';
            if (i.gender && i.gender !== genderCode) return false;
        }
        if (filterGroup) {
            // Safe check for uniformGroup property which might be undefined in old schema
            const groupVal = i.uniformGroup || '';
            const nameVal = i.name || '';
            const match = groupVal === filterGroup || nameVal.includes(filterGroup);
            if (!match) return false;
        }
        return true;
    });

    const updateQty = (itemId, qty) => {
        const item = items.find(i => i.id === itemId);
        if (!item) return;

        const existing = cart.find(c => c.itemId === itemId);
        if (qty <= 0) {
            setCart(cart.filter(c => c.itemId !== itemId));
        } else {
            if (existing) {
                setCart(cart.map(c => c.itemId === itemId ? { ...c, quantity: qty } : c));
            } else {
                setCart([...cart, { itemId: item.id, quantity: qty, item }]);
            }
        }
    };

    const totalAmount = cart.reduce((sum, c) => sum + (c.item.purchasePrice || 0) * c.quantity, 0);

    const handleSubmit = async () => {
        if (!form.customerName || !form.customerPhone || !form.studentName) return alert('Mohon lengkapi data diri');
        if (cart.length === 0) return alert('Pilih minimal satu seragam');

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
            setStep(3);
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

    if (step === 3 && orderResult) {
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
            {/* Simple Header */}
            <div className="bg-indigo-600 text-white p-4 sticky top-0 z-50 shadow-md flex justify-between items-center">
                <div>
                    <h1 className="font-bold text-lg">Pesan Seragam</h1>
                    <p className="text-xs text-indigo-200">Yayasan Pendidikan</p>
                </div>
                <button onClick={() => setShowCheck(!showCheck)} className="text-xs bg-white/20 px-3 py-1 rounded flex items-center gap-1"><Search size={14} /> Cek</button>
            </div>

            {/* Check Modal */}
            {showCheck && (
                <div className="p-4 bg-white border-b border-slate-200 space-y-3">
                    <h3 className="font-bold text-sm">Cek Status</h3>
                    <div className="flex gap-2">
                        <input value={checkCode} onChange={e => setCheckCode(e.target.value.toUpperCase())} placeholder="Kode (ORD/...)" className="border p-2 rounded w-1/2 text-sm" />
                        <input value={checkPhone} onChange={e => setCheckPhone(e.target.value)} placeholder="No HP" className="border p-2 rounded w-1/2 text-sm" />
                    </div>
                    <button onClick={handleCheckOrder} className="bg-slate-800 text-white w-full py-2 rounded text-sm font-bold">Cek Status</button>
                    {checkResult && (
                        <div className="bg-slate-100 p-3 rounded text-sm mt-2">
                            <div className="font-bold">{checkResult.code} - {checkResult.status}</div>
                            <div>{checkResult.studentName}</div>
                            <ul className="list-disc pl-4 mt-1 text-xs text-slate-600">
                                {checkResult.items?.map((i, idx) => <li key={idx}>{i.item.name} x{i.quantity}</li>)}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            <div className="max-w-3xl mx-auto p-4 space-y-6">

                {/* 1. Pilih Unit */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                        <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                        Pilih Unit
                    </h2>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {USERS_UNITS.map(u => (
                            <button key={u} onClick={() => { setSelectedUnit(u); setStep(2); }}
                                className={`p-2 text-sm rounded-lg border transition ${selectedUnit === u ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
                                {u}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 2. Pilih Item (Only if Unit Selected) */}
                {selectedUnit && (
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                                Pilih Seragam
                            </h2>
                            {loading && <Loader2 size={16} className="animate-spin text-slate-400" />}
                        </div>

                        {/* Filters */}
                        <div className="bg-slate-50 p-3 rounded-lg mb-4 space-y-3">
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-1">Gender</label>
                                <div className="flex gap-2">
                                    <button onClick={() => setFilterGender('Ikhwan')} className={`flex-1 py-1.5 text-xs font-bold rounded border ${filterGender === 'Ikhwan' ? 'bg-white border-indigo-500 text-indigo-600 shadow-sm' : 'border-slate-200 text-slate-500'}`}>Ikhwan</button>
                                    <button onClick={() => setFilterGender('Akhwat')} className={`flex-1 py-1.5 text-xs font-bold rounded border ${filterGender === 'Akhwat' ? 'bg-white border-pink-500 text-pink-600 shadow-sm' : 'border-slate-200 text-slate-500'}`}>Akhwat</button>
                                    <button onClick={() => setFilterGender('')} className={`px-3 py-1.5 text-xs font-bold rounded border ${!filterGender ? 'bg-slate-200 text-slate-700' : 'border-slate-200 text-slate-400'}`}>Semua</button>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-1">Kategori</label>
                                <select className="w-full text-sm border-slate-300 rounded-md p-2" value={filterGroup} onChange={e => setFilterGroup(e.target.value)}>
                                    <option value="">-- Semua Kategori --</option>
                                    {UNIFORM_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Items List */}
                        <div className="space-y-3 animate-in fade-in">
                            <h3 className="font-bold text-slate-800 text-sm ml-1">Daftar Seragam ({filteredItems.length} item)</h3>
                            {filteredItems.length === 0 ? (
                                <div className="bg-slate-50 rounded-xl p-8 text-center text-slate-400 text-sm">
                                    Tidak ada item yang sesuai filter. <br />
                                    <button onClick={() => { setFilterGender(''); setFilterGroup(''); }} className="text-indigo-600 font-bold mt-2 underline">Reset Filter</button>
                                </div>
                            ) : (
                                filteredItems.map(item => {
                                    const inCart = cart.find(c => c.itemId === item.id);
                                    const qty = inCart ? inCart.quantity : 0;
                                    return (
                                        <div key={item.id} className="flex justify-between items-center p-3 border rounded-lg hover:border-indigo-200 transition bg-white">
                                            <div className="flex-1">
                                                <div className="font-bold text-sm text-slate-800">{item.name}</div>
                                                <div className="text-xs text-slate-500">
                                                    {item.size || 'All Size'} • <span className={item.stock <= 0 ? 'text-orange-600 font-bold' : 'text-green-600'}>{item.stock <= 0 ? 'Pre-Order' : `Stok: ${item.stock}`}</span>
                                                </div>
                                                <div className="text-xs font-medium text-slate-700 mt-1">Rp {(item.purchasePrice || 0).toLocaleString('id-ID')}</div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button onClick={() => updateQty(item.id, qty - 1)} className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200"><Minus size={14} /></button>
                                                <input
                                                    type="number"
                                                    className="w-12 text-center text-sm font-bold border rounded py-1"
                                                    value={qty}
                                                    onChange={e => updateQty(item.id, parseInt(e.target.value) || 0)}
                                                    onFocus={e => e.target.select()}
                                                />
                                                <button onClick={() => updateQty(item.id, qty + 1)} className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200"><Plus size={14} /></button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}

                {/* 3. Data Diri (Only if Items in Cart) */}
                {cart.length > 0 && (
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 animate-in fade-in slide-in-from-bottom-4">
                        <h2 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                            Data Pemesan
                        </h2>
                        <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div><label className="text-xs font-bold text-slate-500 block mb-1">Nama Siswa</label><input className="w-full border p-2 rounded text-sm" value={form.studentName} onChange={e => setForm({ ...form, studentName: e.target.value })} placeholder="Nama Lengkap" /></div>
                                <div><label className="text-xs font-bold text-slate-500 block mb-1">Kelas</label><input className="w-full border p-2 rounded text-sm" value={form.studentClass} onChange={e => setForm({ ...form, studentClass: e.target.value })} placeholder="3A" /></div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div><label className="text-xs font-bold text-slate-500 block mb-1">Nama Ortu</label><input className="w-full border p-2 rounded text-sm" value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} placeholder="Nama Orang Tua" /></div>
                                <div><label className="text-xs font-bold text-slate-500 block mb-1">No HP / WA</label><input className="w-full border p-2 rounded text-sm" value={form.customerPhone} onChange={e => setForm({ ...form, customerPhone: e.target.value })} placeholder="08xxxxxxxx" /></div>
                            </div>
                            <div><label className="text-xs font-bold text-slate-500 block mb-1">Catatan</label><textarea className="w-full border p-2 rounded text-sm" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} rows={2} /></div>
                        </div>

                        {/* Summary & Submit */}
                        <div className="mt-6 pt-4 border-t border-slate-100">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-sm font-bold text-slate-600">Total ({cart.reduce((s, c) => s + c.quantity, 0)} item)</span>
                                <span className="text-xl font-bold text-indigo-600">Rp {totalAmount.toLocaleString('id-ID')}</span>
                            </div>
                            <button onClick={handleSubmit} disabled={loading} className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold shadow-lg transition flex justify-center items-center gap-2">
                                {loading ? <Loader2 className="animate-spin" /> : <Check />}
                                Kirim Pesanan
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UniformOrderPage;
