import { useState, useEffect } from 'react';
import { ShoppingBag, ChevronRight, ChevronLeft, Check, User, Phone, School, Search, Minus, Plus, Loader2 } from 'lucide-react';

const UNITS = ['TK', 'TAUD', 'SD', 'SMP', 'SMA', 'Pondok Putra', 'Pondok Putri', 'MIT', 'Yayasan'];

const UNIFORM_GROUPS = ['Nasional', 'Batik', 'Muslim', 'Pramuka', 'Olahraga', 'Jubah Hitam', 'Jubah Putih', 'Lainnya'];
const USERS_UNITS = ['TK', 'TAUD', 'SD', 'SMP', 'SMA', 'Pondok Putra', 'Pondok Putri', 'MIT', 'Yayasan'];

const UniformOrderPage = () => {
    const [step, setStep] = useState(1);
    const [selectedUnit, setSelectedUnit] = useState('');
    const [items, setItems] = useState([]); // All items from API
    const [cart, setCart] = useState([]);

    // Filter States
    const [filterGender, setFilterGender] = useState(''); // Ikhwan, Akhwat
    const [filterGroup, setFilterGroup] = useState('');   // Nasional, Batik...
    const [filterType, setFilterType] = useState('');     // Baju, Celana, etc. (Optional/Derived)

    const [form, setForm] = useState({ customerName: '', customerPhone: '', studentName: '', studentClass: '', note: '' });
    const [loading, setLoading] = useState(false);
    const [orderResult, setOrderResult] = useState(null);
    const [checkCode, setCheckCode] = useState('');
    const [checkPhone, setCheckPhone] = useState('');
    const [checkResult, setCheckResult] = useState(null);
    const [showCheck, setShowCheck] = useState(false);

    const API_BASE = window.location.origin.includes('localhost') ? 'http://localhost:5000' : '';

    // Fetch items when Unit is selected
    useEffect(() => {
        if (selectedUnit) {
            fetch(`${API_BASE}/api/uniform-order/items?unit=${encodeURIComponent(selectedUnit)}`)
                .then(r => r.json())
                .then(d => {
                    setItems(d.items || []);
                    // Reset filters
                    setFilterGender('');
                    setFilterGroup('');
                    setFilterType('');
                })
                .catch(() => setItems([]));
        }
    }, [selectedUnit]);

    // Derived Lists based on filters
    const availableGroups = UNIFORM_GROUPS; // Or derived from items if needed

    const filteredItems = items.filter(i => {
        if (filterGender && i.gender && i.gender !== (filterGender === 'Ikhwan' ? 'L' : 'P')) return false;
        if (filterGroup) {
            // Check uniformGroup field match, or simple keyword match if field missing
            const groupMatch = i.uniformGroup === filterGroup || (i.name && i.name.includes(filterGroup));
            if (!groupMatch) return false;
        }
        return true;
    });

    // Unique Types in current filtered list (e.g. Baju, Celana)
    const availableTypes = [...new Set(filteredItems.map(i => i.type).filter(Boolean))];

    // Final list to display (grouped by Type then Size?)
    // Actually, usually user selects Type then sees Sizes.
    // Let's implement Type filter selection if Types exist.
    const displayItems = filteredItems.filter(i => !filterType || i.type === filterType);

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
                // if (newQty > c.item.stock) return c; // Removed cap
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
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg sticky top-0 z-50">
                <div className="max-w-2xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                <ShoppingBag size={22} />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold">Pesan Seragam</h1>
                                <p className="text-xs text-indigo-200">Yayasan Pendidikan</p>
                            </div>
                        </div>
                        <button onClick={() => setShowCheck(!showCheck)} className="text-xs bg-white/20 px-3 py-1.5 rounded-lg hover:bg-white/30 transition flex items-center gap-1">
                            <Search size={14} /> Cek Pesanan
                        </button>
                    </div>
                </div>
            </div>

            {/* Check Order Modal */}
            {showCheck && (
                <div className="max-w-2xl mx-auto px-4 py-4 animate-in slide-in-from-top-4">
                    <div className="bg-white rounded-xl p-4 shadow-xl border border-slate-200 space-y-3">
                        <h3 className="font-bold text-slate-800 border-b pb-2">Cek Status Pesanan</h3>
                        <div className="grid grid-cols-2 gap-2">
                            <input value={checkCode} onChange={e => setCheckCode(e.target.value.toUpperCase())} placeholder="Kode (ORD/...)" className="w-full px-3 py-2 border rounded-lg text-sm" />
                            <input value={checkPhone} onChange={e => setCheckPhone(e.target.value)} placeholder="No HP" className="w-full px-3 py-2 border rounded-lg text-sm" />
                        </div>
                        <button onClick={handleCheckOrder} className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-bold">Cek Status</button>
                        {checkResult && (
                            <div className="bg-slate-50 rounded-lg p-3 space-y-2 text-sm">
                                <div className="flex justify-between items-center">
                                    <span className="font-mono font-bold">{checkResult.code}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusColor[checkResult.status]}`}>{statusLabel[checkResult.status]}</span>
                                </div>
                                <p className="text-xs text-slate-500">Siswa: {checkResult.studentName} ({checkResult.customerUnit})</p>
                                <div className="space-y-1 pt-1 border-t border-slate-200">
                                    {checkResult.items?.map((oi, i) => (
                                        <div key={i} className="flex justify-between text-xs">
                                            <span>{oi.item.name} ({oi.item.size})</span>
                                            <span className="font-mono">x{oi.quantity}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="max-w-2xl mx-auto px-4 py-6 pb-24">

                {/* Step 1: Select Unit */}
                {step === 1 && (
                    <div className="space-y-6 animate-in fade-in">
                        <div className="text-center space-y-2">
                            <h2 className="text-2xl font-bold text-slate-800">Pilih Unit Sekolah</h2>
                            <p className="text-slate-500 text-sm">Silakan pilih unit pendidikan putra/putri Anda</p>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {USERS_UNITS.map(u => (
                                <button key={u} onClick={() => { setSelectedUnit(u); setCart([]); setStep(2); }}
                                    className="bg-white rounded-xl p-4 text-center shadow-sm border-2 border-transparent hover:border-indigo-500 hover:shadow-md transition-all group relative overflow-hidden">
                                    <div className="absolute inset-0 bg-indigo-50 opacity-0 group-hover:opacity-100 transition duration-300"></div>
                                    <div className="relative z-10">
                                        <School size={32} className="mx-auto mb-3 text-indigo-400 group-hover:text-indigo-600 transition-transform group-hover:scale-110" />
                                        <span className="font-bold text-slate-700 text-sm">{u}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Step 2: Filter & Select Items */}
                {step === 2 && (
                    <div className="space-y-4 animate-in fade-in">
                        {/* NavBar */}
                        <div className="flex items-center justify-between bg-white p-3 rounded-xl shadow-sm">
                            <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600 font-medium">
                                <ChevronLeft size={18} /> Ganti Unit
                            </button>
                            <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">{selectedUnit}</span>
                        </div>

                        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 space-y-4">
                            <h2 className="font-bold text-slate-800 flex items-center gap-2"><Filter size={18} /> Filter Seragam</h2>

                            {/* Filter Logic */}
                            <div className="space-y-3">
                                {/* 1. Gender */}
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">1. Gender</label>
                                    <div className="flex gap-2">
                                        {['Ikhwan', 'Akhwat'].map(g => (
                                            <button key={g} onClick={() => { setFilterGender(g); setFilterGroup(''); setFilterType(''); }}
                                                className={`flex-1 py-2 rounded-lg text-sm font-bold border transition ${filterGender === g ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
                                                {g === 'Ikhwan' ? 'Laki-laki (Ikhwan)' : 'Perempuan (Akhwat)'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* 2. Group (Only if Gender selected) */}
                                {filterGender && (
                                    <div className="animate-in slide-in-from-top-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">2. Jenis Seragam</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {availableGroups.map(grp => (
                                                <button key={grp} onClick={() => { setFilterGroup(grp); setFilterType(''); }}
                                                    className={`py-2 px-3 rounded-lg text-xs font-bold border text-left transition ${filterGroup === grp ? 'bg-indigo-600 text-white border-indigo-600 shadow' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
                                                    {grp}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* 3. Type (Optional, derived from items) */}
                                {filterGroup && availableTypes.length > 0 && (
                                    <div className="animate-in slide-in-from-top-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">3. Tipe Item</label>
                                        <div className="flex flex-wrap gap-2">
                                            <button onClick={() => setFilterType('')} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${!filterType ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-600'}`}>Semua</button>
                                            {availableTypes.map(typ => (
                                                <button key={typ} onClick={() => setFilterType(typ)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${filterType === typ ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-600'}`}>
                                                    {typ}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Items List */}
                        {filterGender && filterGroup ? (
                            <div className="space-y-3 animate-in fade-in">
                                <h3 className="font-bold text-slate-800 text-sm ml-1">Pilih Ukuran ({displayItems.length} item)</h3>
                                {displayItems.length === 0 ? (
                                    <div className="bg-slate-50 rounded-xl p-8 text-center text-slate-400 text-sm">Tidak ada item yang sesuai filter.</div>
                                ) : (
                                    displayItems.map(item => {
                                        const inCart = cart.find(c => c.itemId === item.id);
                                        return (
                                            <div key={item.id} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex items-center justify-between hover:border-indigo-200 transition">
                                                <div>
                                                    <div className="font-bold text-slate-800 text-sm">{item.name}</div>
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold">{item.size || 'ALL SIZE'}</span>
                                                        {item.type && <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">{item.type}</span>}
                                                    </div>
                                                    <div className="text-xs mt-2">
                                                        <span className={item.stock <= 0 ? 'text-orange-600 font-bold' : 'text-slate-500'}>
                                                            {item.stock <= 0 ? 'Pre-Order' : `Stok: ${item.stock}`}
                                                        </span>
                                                        {item.purchasePrice > 0 && <span className="ml-2 font-medium text-slate-700">Rp {item.purchasePrice.toLocaleString('id-ID')}</span>}
                                                    </div>
                                                </div>
                                                <div>
                                                    {inCart ? (
                                                        <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-1">
                                                            <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 rounded bg-white shadow-sm flex items-center justify-center hover:text-red-600"><Minus size={14} /></button>
                                                            <span className="font-bold text-indigo-600 w-6 text-center text-sm">{inCart.quantity}</span>
                                                            <button onClick={() => updateQty(item.id, 1)} className="w-7 h-7 rounded bg-white shadow-sm flex items-center justify-center hover:text-green-600"><Plus size={14} /></button>
                                                        </div>
                                                    ) : (
                                                        <button onClick={() => addToCart(item)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 transition shadow-sm flex items-center gap-1">
                                                            <Plus size={14} /> Pilih
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        ) : (
                            <div className="bg-indigo-50/50 rounded-xl p-8 text-center border border-indigo-100 border-dashed">
                                <div className="text-indigo-400 mb-2"><Search size={32} className="mx-auto" /></div>
                                <p className="text-sm text-indigo-800 font-medium">Silakan pilih Gender dan Jenis Seragam di atas untuk melihat daftar item.</p>
                            </div>
                        )}

                        {/* Cart Summary Floating */}
                        {cart.length > 0 && (
                            <div className="fixed bottom-4 left-4 right-4 z-40 max-w-2xl mx-auto">
                                <div className="bg-slate-900/90 backdrop-blur text-white rounded-xl p-4 shadow-2xl flex items-center justify-between border border-white/10 animate-in slide-in-from-bottom-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center font-bold">{cart.reduce((s, c) => s + c.quantity, 0)}</div>
                                        <div>
                                            <div className="text-xs text-slate-300">Total Pesanan</div>
                                            <div className="font-bold font-mono">Rp {totalAmount.toLocaleString('id-ID')}</div>
                                        </div>
                                    </div>
                                    <button onClick={() => setStep(3)} className="bg-white text-indigo-600 px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-indigo-50 transition">
                                        Lanjut <ChevronRight size={16} className="inline" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Step 3: Customer Info */}
                {step === 3 && (
                    <div className="space-y-4 animate-in fade-in">
                        <button onClick={() => setStep(2)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600">
                            <ChevronLeft size={16} /> Kembali ke Pilihan
                        </button>
                        <h2 className="text-xl font-bold text-slate-800">Lengkapi Data Pemesan</h2>
                        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Nama Siswa *</label>
                                <input value={form.studentName} onChange={e => setForm({ ...form, studentName: e.target.value })} placeholder="Nama Lengkap Siswa" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition" required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Kelas</label>
                                    <input value={form.studentClass} onChange={e => setForm({ ...form, studentClass: e.target.value })} placeholder="Contoh: 3A" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 transition" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">No HP / WA *</label>
                                    <div className="relative">
                                        <Phone size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                                        <input value={form.customerPhone} onChange={e => setForm({ ...form, customerPhone: e.target.value })} placeholder="08xxxxxxxxxx" className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 transition" required />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Nama Orang Tua/Wali *</label>
                                <div className="relative">
                                    <User size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                                    <input value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} placeholder="Nama Orang Tua" className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 transition" required />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Catatan</label>
                                <textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Opsional" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 transition" rows={2} />
                            </div>
                        </div>
                        <button onClick={() => setStep(4)} className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2">
                            Lihat Ringkasan <ChevronRight size={16} />
                        </button>
                    </div>
                )}

                {/* Step 4: Confirmation (Same as before but simplified styling) */}
                {step === 4 && (
                    <div className="space-y-4 animate-in fade-in">
                        <button onClick={() => setStep(3)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600">
                            <ChevronLeft size={16} /> Edit Data
                        </button>
                        <h2 className="text-xl font-bold text-slate-800">Konfirmasi Pesanan</h2>
                        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 space-y-4">
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Data Pemesan</h3>
                                <div className="grid grid-cols-2 gap-y-2 text-sm">
                                    <div className="text-slate-500">Siswa</div><div className="font-bold">{form.studentName} ({form.studentClass || '-'})</div>
                                    <div className="text-slate-500">Unit</div><div className="font-bold">{selectedUnit}</div>
                                    <div className="text-slate-500">Orang Tua</div><div className="font-bold">{form.customerName}</div>
                                    <div className="text-slate-500">No HP</div><div className="font-bold">{form.customerPhone}</div>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Item Pesanan</h3>
                                <div className="space-y-2">
                                    {cart.map(c => (
                                        <div key={c.itemId} className="flex justify-between items-center text-sm border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                                            <div>
                                                <div className="font-bold text-slate-800">{c.item.name}</div>
                                                <div className="text-xs text-slate-500">{c.item.size} • {c.item.uniformGroup}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold">x{c.quantity}</div>
                                                <div className="text-xs text-slate-400">Rp {((c.item.purchasePrice || 0) * c.quantity).toLocaleString('id-ID')}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-between items-center mt-4 pt-4 border-t border-dashed border-slate-200">
                                    <span className="font-bold text-lg">Total Estimasi</span>
                                    <span className="font-bold text-xl text-indigo-600">Rp {totalAmount.toLocaleString('id-ID')}</span>
                                </div>
                            </div>
                        </div>
                        <button onClick={handleSubmit} disabled={loading}
                            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 rounded-xl font-bold shadow-xl hover:shadow-2xl transition disabled:opacity-50 flex items-center justify-center gap-2 text-lg">
                            {loading ? <><Loader2 size={24} className="animate-spin" /> Memproses...</> : <><Check size={24} /> Kirim Pesanan Sekarang</>}
                        </button>
                    </div>
                )}

                {/* Step 5: Success (Keep existing) */}
                {step === 5 && orderResult && (
                    <div className="space-y-6 animate-in fade-in text-center py-12">
                        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto shadow-inner">
                            <Check size={48} className="text-green-600" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-bold text-slate-800 mb-2">Pesanan Diterima!</h2>
                            <p className="text-slate-500">Terima kasih, admin kami akan segera memproses pesanan Anda.</p>
                        </div>

                        <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-100 max-w-sm mx-auto relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                            <div className="space-y-1 mb-4">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Kode Pesanan</span>
                                <div className="text-3xl font-mono font-bold text-indigo-600 tracking-tight">{orderResult.code}</div>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500 border border-slate-100">
                                Simpan kode ini atau screenshot halaman ini untuk melakukan pengecekan status pesanan.
                            </div>
                        </div>

                        <button onClick={() => window.location.reload()}
                            className="text-indigo-600 font-bold hover:bg-indigo-50 px-6 py-3 rounded-xl transition">
                            Buat Pesanan Baru
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UniformOrderPage;
