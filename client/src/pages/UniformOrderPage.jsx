import { useState, useEffect } from 'react';
import { ShoppingBag, ChevronRight, ChevronLeft, Check, User, Phone, School, Search, Minus, Plus, Loader2 } from 'lucide-react';

const UNITS = ['TK', 'TAUD', 'SD', 'SMP', 'SMA', 'Pondok Putra', 'Pondok Putri', 'MIT', 'Yayasan'];

const UniformOrderPage = () => {
    const [step, setStep] = useState(1);
    const [selectedUnit, setSelectedUnit] = useState('');
    const [items, setItems] = useState([]);
    const [cart, setCart] = useState([]);
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
            fetch(`${API_BASE}/api/uniform-order/items?unit=${encodeURIComponent(selectedUnit)}`)
                .then(r => r.json())
                .then(d => setItems(d.items || []))
                .catch(() => setItems([]));
        }
    }, [selectedUnit]);

    const addToCart = (item) => {
        const exists = cart.find(c => c.itemId === item.id);
        if (exists) {
            setCart(cart.map(c => c.itemId === item.id ? { ...c, quantity: c.quantity + 1 } : c));
        } else {
            setCart([...cart, { itemId: item.id, quantity: 1, item }]);
        }
    };

    const updateQty = (itemId, delta) => {
        setCart(cart.map(c => {
            if (c.itemId === itemId) {
                const newQty = c.quantity + delta;
                if (newQty <= 0) return null;
                if (newQty > c.item.stock) return c;
                return { ...c, quantity: newQty };
            }
            return c;
        }).filter(Boolean));
    };

    const removeFromCart = (itemId) => {
        setCart(cart.filter(c => c.itemId !== itemId));
    };

    const totalAmount = cart.reduce((sum, c) => sum + (c.item.purchasePrice || 0) * c.quantity, 0);

    const handleSubmit = async () => {
        if (!form.customerName || !form.customerPhone || !form.studentName) {
            return alert('Mohon lengkapi data diri');
        }
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/uniform-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    customerUnit: selectedUnit,
                    items: cart.map(c => ({ itemId: c.itemId, quantity: c.quantity }))
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setOrderResult(data.order);
            setStep(5);
        } catch (e) {
            alert(e.message || 'Gagal membuat pesanan');
        } finally { setLoading(false); }
    };

    const handleCheckOrder = async () => {
        if (!checkCode) return alert('Masukkan kode pesanan');
        try {
            const res = await fetch(`${API_BASE}/api/uniform-order/check/${checkCode}?phone=${checkPhone}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setCheckResult(data);
        } catch (e) { alert(e.message); }
    };

    const statusLabel = { PENDING: 'Menunggu Konfirmasi', CONFIRMED: 'Dikonfirmasi', READY: 'Siap Diambil', PICKED_UP: 'Sudah Diambil', CANCELLED: 'Dibatalkan' };
    const statusColor = { PENDING: 'bg-yellow-100 text-yellow-700', CONFIRMED: 'bg-blue-100 text-blue-700', READY: 'bg-green-100 text-green-700', PICKED_UP: 'bg-slate-100 text-slate-600', CANCELLED: 'bg-red-100 text-red-600' };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                <div className="max-w-2xl mx-auto px-4 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                <ShoppingBag size={22} />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold">Pesan Seragam</h1>
                                <p className="text-xs text-indigo-200">Yayasan Pendidikan</p>
                            </div>
                        </div>
                        <button onClick={() => setShowCheck(!showCheck)} className="text-xs bg-white/20 px-3 py-1.5 rounded-lg hover:bg-white/30 transition">
                            <Search size={14} className="inline mr-1" /> Cek Pesanan
                        </button>
                    </div>
                </div>
            </div>

            {/* Check Order Modal */}
            {showCheck && (
                <div className="max-w-2xl mx-auto px-4 py-4">
                    <div className="bg-white rounded-xl p-4 shadow-lg border border-slate-200 space-y-3">
                        <h3 className="font-bold text-slate-800">Cek Status Pesanan</h3>
                        <input value={checkCode} onChange={e => setCheckCode(e.target.value.toUpperCase())} placeholder="Kode Pesanan (ORD/2026/001)" className="w-full px-3 py-2 border rounded-lg text-sm" />
                        <input value={checkPhone} onChange={e => setCheckPhone(e.target.value)} placeholder="No HP Pemesan" className="w-full px-3 py-2 border rounded-lg text-sm" />
                        <button onClick={handleCheckOrder} className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-bold">Cek Status</button>
                        {checkResult && (
                            <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="font-mono text-sm font-bold">{checkResult.code}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusColor[checkResult.status]}`}>
                                        {statusLabel[checkResult.status]}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500">Siswa: {checkResult.studentName} • Unit: {checkResult.customerUnit}</p>
                                <div className="text-xs space-y-1">
                                    {checkResult.items?.map((oi, i) => (
                                        <div key={i} className="flex justify-between">
                                            <span>{oi.item.name} ({oi.item.size})</span>
                                            <span>x{oi.quantity}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Stepper */}
            {step < 5 && (
                <div className="max-w-2xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-center gap-1">
                        {['Pilih Unit', 'Pilih Seragam', 'Data Diri', 'Konfirmasi'].map((label, i) => (
                            <div key={i} className="flex items-center gap-1">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step > i + 1 ? 'bg-green-500 text-white' : step === i + 1 ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-200 text-slate-400'}`}>
                                    {step > i + 1 ? <Check size={14} /> : i + 1}
                                </div>
                                <span className={`text-[10px] font-bold hidden sm:inline ${step === i + 1 ? 'text-indigo-600' : 'text-slate-400'}`}>{label}</span>
                                {i < 3 && <ChevronRight size={14} className="text-slate-300 mx-1" />}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="max-w-2xl mx-auto px-4 pb-8">
                {/* Step 1: Select Unit */}
                {step === 1 && (
                    <div className="space-y-4 animate-in fade-in">
                        <div className="text-center mb-4">
                            <h2 className="text-lg font-bold text-slate-800">Pilih Unit</h2>
                            <p className="text-sm text-slate-500">Seragam untuk unit mana?</p>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {UNITS.map(u => (
                                <button key={u} onClick={() => { setSelectedUnit(u); setCart([]); setStep(2); }}
                                    className="bg-white rounded-xl p-4 text-center shadow-sm border-2 border-slate-100 hover:border-indigo-400 hover:shadow-md transition-all group">
                                    <School size={28} className="mx-auto mb-2 text-indigo-400 group-hover:text-indigo-600 transition" />
                                    <span className="font-bold text-slate-700 text-sm">{u}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Step 2: Select Items */}
                {step === 2 && (
                    <div className="space-y-4 animate-in fade-in">
                        <div className="flex items-center justify-between mb-2">
                            <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600">
                                <ChevronLeft size={16} /> Ganti Unit
                            </button>
                            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">{selectedUnit}</span>
                        </div>
                        <h2 className="text-lg font-bold text-slate-800">Pilih Seragam</h2>

                        {items.length === 0 ? (
                            <div className="bg-white rounded-xl p-8 text-center text-slate-400 shadow-sm">Belum ada seragam tersedia untuk unit ini.</div>
                        ) : (
                            <div className="space-y-2">
                                {items.map(item => {
                                    const inCart = cart.find(c => c.itemId === item.id);
                                    return (
                                        <div key={item.id} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex items-center justify-between">
                                            <div>
                                                <div className="font-bold text-slate-800 text-sm">{item.name}</div>
                                                <div className="text-xs text-slate-500 space-x-2">
                                                    {item.type && <span className="bg-slate-100 px-1.5 py-0.5 rounded">{item.type}</span>}
                                                    {item.gender && <span>{item.gender === 'L' ? 'Ikhwan' : 'Akhwat'}</span>}
                                                    {item.size && <span className="font-bold">{item.size}</span>}
                                                </div>
                                                <div className="text-xs text-slate-400 mt-1">
                                                    Stok: <span className={item.stock <= 5 ? 'text-red-500 font-bold' : 'text-green-600'}>{item.stock}</span>
                                                    {item.purchasePrice > 0 && <span className="ml-2">• Rp {item.purchasePrice.toLocaleString('id-ID')}</span>}
                                                </div>
                                            </div>
                                            <div>
                                                {inCart ? (
                                                    <div className="flex items-center gap-2">
                                                        <button onClick={() => updateQty(item.id, -1)} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-red-100 transition"><Minus size={14} /></button>
                                                        <span className="font-bold text-indigo-600 w-6 text-center">{inCart.quantity}</span>
                                                        <button onClick={() => updateQty(item.id, 1)} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-green-100 transition"><Plus size={14} /></button>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => addToCart(item)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 transition shadow">
                                                        + Tambah
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {cart.length > 0 && (
                            <div className="sticky bottom-4 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-4 text-white shadow-xl flex items-center justify-between">
                                <div>
                                    <div className="text-xs opacity-80">{cart.reduce((s, c) => s + c.quantity, 0)} item</div>
                                    <div className="font-bold">Rp {totalAmount.toLocaleString('id-ID')}</div>
                                </div>
                                <button onClick={() => setStep(3)} className="bg-white text-indigo-600 px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-indigo-50 transition">
                                    Lanjut <ChevronRight size={16} className="inline" />
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Step 3: Customer Info */}
                {step === 3 && (
                    <div className="space-y-4 animate-in fade-in">
                        <button onClick={() => setStep(2)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600">
                            <ChevronLeft size={16} /> Kembali
                        </button>
                        <h2 className="text-lg font-bold text-slate-800">Data Pemesan</h2>
                        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1"><User size={12} className="inline mr-1" />Nama Pemesan (Orang Tua/Wali) *</label>
                                <input value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} placeholder="Nama lengkap" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm" required />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1"><Phone size={12} className="inline mr-1" />No HP/WhatsApp *</label>
                                <input value={form.customerPhone} onChange={e => setForm({ ...form, customerPhone: e.target.value })} placeholder="08xxxxxxxxxx" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm" required />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1"><School size={12} className="inline mr-1" />Nama Siswa *</label>
                                <input value={form.studentName} onChange={e => setForm({ ...form, studentName: e.target.value })} placeholder="Nama siswa" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm" required />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Kelas</label>
                                <input value={form.studentClass} onChange={e => setForm({ ...form, studentClass: e.target.value })} placeholder="Contoh: 3A" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Catatan</label>
                                <textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Catatan tambahan (opsional)" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm" rows={2} />
                            </div>
                        </div>
                        <button onClick={() => setStep(4)} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition">
                            Lihat Ringkasan <ChevronRight size={16} className="inline" />
                        </button>
                    </div>
                )}

                {/* Step 4: Confirmation */}
                {step === 4 && (
                    <div className="space-y-4 animate-in fade-in">
                        <button onClick={() => setStep(3)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600">
                            <ChevronLeft size={16} /> Kembali
                        </button>
                        <h2 className="text-lg font-bold text-slate-800">Konfirmasi Pesanan</h2>
                        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 space-y-4">
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div><span className="text-xs text-slate-400 block">Pemesan</span><span className="font-bold">{form.customerName}</span></div>
                                <div><span className="text-xs text-slate-400 block">HP</span><span className="font-bold">{form.customerPhone}</span></div>
                                <div><span className="text-xs text-slate-400 block">Siswa</span><span className="font-bold">{form.studentName}</span></div>
                                <div><span className="text-xs text-slate-400 block">Unit</span><span className="font-bold">{selectedUnit}</span></div>
                                {form.studentClass && <div><span className="text-xs text-slate-400 block">Kelas</span><span className="font-bold">{form.studentClass}</span></div>}
                            </div>
                            <hr />
                            <div className="space-y-2">
                                {cart.map(c => (
                                    <div key={c.itemId} className="flex justify-between items-center text-sm">
                                        <div>
                                            <span className="font-bold">{c.item.name}</span>
                                            <span className="text-xs text-slate-400 ml-1">({c.item.size}) {c.item.gender === 'L' ? 'Ikhwan' : 'Akhwat'}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-slate-500">x{c.quantity}</span>
                                            <div className="text-xs font-mono">Rp {((c.item.purchasePrice || 0) * c.quantity).toLocaleString('id-ID')}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <hr />
                            <div className="flex justify-between font-bold text-lg">
                                <span>Total</span>
                                <span className="text-indigo-600">Rp {totalAmount.toLocaleString('id-ID')}</span>
                            </div>
                            {form.note && <div className="text-xs text-slate-400">Catatan: {form.note}</div>}
                        </div>
                        <button onClick={handleSubmit} disabled={loading}
                            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3.5 rounded-xl font-bold shadow-xl hover:shadow-2xl transition disabled:opacity-50 flex items-center justify-center gap-2 text-lg">
                            {loading ? <><Loader2 size={20} className="animate-spin" /> Memproses...</> : <><Check size={20} /> Kirim Pesanan</>}
                        </button>
                    </div>
                )}

                {/* Step 5: Success */}
                {step === 5 && orderResult && (
                    <div className="space-y-4 animate-in fade-in text-center py-8">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                            <Check size={40} className="text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-green-700">Pesanan Berhasil!</h2>
                        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 max-w-sm mx-auto space-y-3">
                            <div>
                                <span className="text-xs text-slate-400">Kode Pesanan</span>
                                <div className="text-2xl font-mono font-bold text-indigo-600">{orderResult.code}</div>
                            </div>
                            <p className="text-xs text-slate-500">Simpan kode ini untuk mengecek status pesanan Anda. Admin akan segera mengkonfirmasi pesanan.</p>
                            <div className="text-sm font-bold">Total: Rp {orderResult.totalAmount?.toLocaleString('id-ID')}</div>
                        </div>
                        <button onClick={() => { setStep(1); setCart([]); setForm({ customerName: '', customerPhone: '', studentName: '', studentClass: '', note: '' }); setOrderResult(null); }}
                            className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-indigo-700 transition">
                            Pesan Lagi
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UniformOrderPage;
