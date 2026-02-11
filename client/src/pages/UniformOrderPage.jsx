import { useState, useEffect, useMemo } from 'react';
import { ShoppingBag, Search, Plus, Trash2, Save, Loader2, Check, User, Shirt, CircleUserRound } from 'lucide-react';

const USERS_UNITS = ['TK', 'TAUD', 'SD', 'SMP', 'SMA', 'Pondok Putra', 'Pondok Putri', 'MIT', 'Yayasan'];

// --- CONFIGURATION V2 ---
const UNIFORM_GROUPS = ['Nasional', 'Muslim', 'Olahraga', 'Batik', 'Pramuka', 'Jubah'];

const UNIFORM_TYPES = [
    'Baju',
    'Celana',
    'Jilbab',
    'Rok Celana',
    'Baju dan Celana', // Stel
    'Baju dan Jilbab', // Stel
    'Baju, Rok Celana dan Jilbab', // Set Olahraga Akhwat
    'Jubah Hitam',
    'Jubah Putih'
];

const SIZES_STD = ['SS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const SIZES_JUBAH = ['38', '40', '42', '44', '46', '48', '50/20', '50/22', '50/24', '52/20', '52/22', '52/24', '54/20', '54/22', '54/24'];
const SIZES_PECI = ['20', '20.5', '21', '21.5', '22', '22.5', '23', '23.5', '24'];

const UniformOrderPage = () => {
    // --- STATE ---

    // 1. Identity
    const [identity, setIdentity] = useState({
        studentName: '',
        gender: '', // 'Ikhwan' / 'Akhwat' (Mapped to L/P internally if needed)
        phone: '',
        unit: ''
    });

    // 2. Data & Cart
    const [items, setItems] = useState([]);
    const [cart, setCart] = useState([]);
    const [loading, setLoading] = useState(false);

    // 3. Item Selection State
    const [activeTab, setActiveTab] = useState('Seragam'); // 'Seragam' | 'Peci'

    // Seragam State
    const [seragamGroup, setSeragamGroup] = useState('');
    const [seragamType, setSeragamType] = useState('');
    const [seragamSize, setSeragamSize] = useState('');
    const [seragamQty, setSeragamQty] = useState(1);

    // Peci State
    const [peciSize, setPeciSize] = useState('');
    const [peciQty, setPeciQty] = useState(1);

    // System
    const [orderResult, setOrderResult] = useState(null);
    const [checkCode, setCheckCode] = useState('');
    const [checkPhone, setCheckPhone] = useState('');
    const [checkResult, setCheckResult] = useState(null);
    const [showCheck, setShowCheck] = useState(false);

    const API_BASE = window.location.origin.includes('localhost') ? 'http://localhost:5000' : '';

    // --- FETCH ITEMS ---
    useEffect(() => {
        if (identity.unit) {
            setLoading(true);
            fetch(`${API_BASE}/api/uniform-order/items?unit=${encodeURIComponent(identity.unit)}`)
                .then(r => r.json())
                .then(d => {
                    setItems(d.items || []);
                    // Clear cart when unit changes? Maybe safer to keep but warn.
                    // setCart([]); 
                })
                .catch(err => {
                    console.error("Fetch error:", err);
                    setItems([]);
                })
                .finally(() => setLoading(false));
        } else {
            setItems([]);
        }
    }, [identity.unit]);

    // --- MATCHING LOGIC ---
    const matchedItem = useMemo(() => {
        if (!identity.unit) return null;
        const normalize = s => s ? s.toLowerCase().trim() : '';
        const selectedGender = identity.gender === 'Ikhwan' ? 'l' : (identity.gender === 'Akhwat' ? 'p' : '');

        if (activeTab === 'Peci') {
            if (!peciSize) return null;
            return items.find(i => {
                const name = normalize(i.name);
                const cat = normalize(i.category?.name);
                const isPeci = name.includes('peci') || name.includes('songkok') || cat.includes('peci');
                return isPeci && i.size === peciSize;
            });
        }

        if (activeTab === 'Seragam') {
            if (!seragamGroup || !seragamType || !seragamSize) return null;

            return items.find(i => {
                const name = normalize(i.name);
                const dbGroup = normalize(i.uniformGroup);
                const dbType = normalize(i.type);
                const dbGender = normalize(i.gender);

                // 1. Gender check (Loose)
                // If item is generic (no gender) or matches selected gender
                const genderMatch = !dbGender || dbGender === selectedGender;
                // Double check name if dbGender is missing
                if (!dbGender && selectedGender === 'l' && (name.includes('putri') || name.includes('akhwat'))) return false;
                if (!dbGender && selectedGender === 'p' && (name.includes('putra') || name.includes('ikhwan'))) return false;

                // 2. Group check
                const selGroup = normalize(seragamGroup);
                const groupMatch = dbGroup.includes(selGroup) || name.includes(selGroup);

                // 3. Type check
                const selType = normalize(seragamType);
                let typeMatch = false;

                if (selType === 'baju') typeMatch = name.includes('baju') || name.includes('kemeja') || dbType === 'baju';
                else if (selType === 'celana') typeMatch = name.includes('celana') || dbType === 'celana';
                else if (selType === 'jilbab') typeMatch = name.includes('jilbab') || name.includes('kerudung');
                else if (selType === 'rok celana') typeMatch = name.includes('rok') && name.includes('celana');
                else if (selType === 'baju dan celana') typeMatch = name.includes('stel') || (name.includes('baju') && name.includes('celana')); // Stel
                else if (selType === 'baju dan jilbab') typeMatch = name.includes('set') && name.includes('jilbab'); // Rare case?
                else if (selType.includes('baju, rok celana dan jilbab')) typeMatch = name.includes('set') && name.includes('olahraga'); // Set Olahraga Akhwat
                else if (selType === 'jubah hitam') typeMatch = name.includes('jubah') && name.includes('hitam');
                else if (selType === 'jubah putih') typeMatch = name.includes('jubah') && name.includes('putih');
                else typeMatch = name.includes(selType);

                // 4. Size check
                const sizeMatch = normalize(i.size) === normalize(seragamSize);

                return genderMatch && groupMatch && typeMatch && sizeMatch;
            });
        }
    }, [items, activeTab, identity, seragamGroup, seragamType, seragamSize, peciSize]);


    // --- HANDLERS ---
    const handleAddItem = () => {
        if (!matchedItem) return alert('Item tidak ditemukan. Pastikan Unit dan Filter sudah benar.');

        const qty = activeTab === 'Seragam' ? seragamQty : peciQty;

        setCart(prev => {
            const existing = prev.find(c => c.itemId === matchedItem.id);
            if (existing) {
                return prev.map(c => c.itemId === matchedItem.id ? { ...c, quantity: c.quantity + qty } : c);
            }
            return [...prev, { itemId: matchedItem.id, quantity: qty, item: matchedItem }];
        });

        // Optional: Reset selection?
    };

    const handleRemoveItem = (id) => setCart(prev => prev.filter(c => c.itemId !== id));

    const handleSubmit = async () => {
        // Validation
        if (!identity.studentName) return alert('Nama Anak wajib diisi');
        if (!identity.gender) return alert('Jenis Kelamin wajib dipilih');
        if (!identity.phone) return alert('Nomor HP wajib diisi');
        if (!identity.unit) return alert('Unit Sekolah wajib dipilih');
        if (cart.length === 0) return alert('Keranjang pesanan kosong');

        if (!confirm('Apakah data sudah benar? Kirim pesanan sekarang?')) return;

        setLoading(true);
        try {
            const payload = {
                studentName: identity.studentName,
                customerPhone: identity.phone,
                customerUnit: identity.unit,
                customerName: '', // Optional parent name not in V2 spec, sending empty
                items: cart.map(c => ({ itemId: c.itemId, quantity: c.quantity })),
                note: `Gender: ${identity.gender}` // Interact as note or extra field
            };

            const res = await fetch(`${API_BASE}/api/uniform-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Gagal mengirim pesanan');
            setOrderResult(data.order);
        } catch (e) {
            alert(e.message);
        } finally {
            setLoading(false);
        }
    };

    // --- RENDER SUCCESS ---
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
                    <p className="text-slate-600">Simpan kode ini atau screenshot halaman ini sebagai bukti pemesanan.</p>
                    <button onClick={() => window.location.reload()} className="bg-indigo-600 text-white w-full py-3 rounded-lg font-bold">Buat Pesanan Baru</button>
                </div>
            </div>
        );
    }

    // --- RENDER MAIN FORM ---
    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            {/* Header */}
            <div className="bg-white border-b sticky top-0 z-50 px-4 py-3 shadow-sm flex justify-between items-center text-slate-800">
                <div className="flex items-center gap-2">
                    <ShoppingBag className="text-indigo-600" />
                    <h1 className="font-bold text-lg">Form Seragam</h1>
                </div>
                {/* Optional Status Check Trigger */}
                <button onClick={() => setShowCheck(!showCheck)} className="text-xs font-bold text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded hover:bg-indigo-50">
                    Cek Pesanan
                </button>
            </div>

            {/* Check Modal */}
            {showCheck && (
                <div className="p-4 bg-indigo-50 border-b border-indigo-200 animate-in slide-in-from-top-2">
                    <div className="flex gap-2 mb-2">
                        <input value={checkCode} onChange={e => setCheckCode(e.target.value.toUpperCase())} placeholder="Kode Pesanan" className="border p-2 rounded w-full text-sm" />
                        <button onClick={async () => {
                            if (!checkCode) return alert('Isi kode');
                            try {
                                const res = await fetch(`${API_BASE}/api/uniform-order/check/${checkCode}`);
                                const d = await res.json();
                                if (!res.ok) throw new Error(d.error);
                                setCheckResult(d);
                            } catch (e) { alert(e.message); }
                        }} className="bg-indigo-600 text-white px-4 rounded text-sm font-bold">Cari</button>
                    </div>
                    {checkResult && (
                        <div className="bg-white p-3 rounded border text-sm">
                            <div className="font-bold">{checkResult.studentName}</div>
                            <div className="text-slate-500">Status: {checkResult.status}</div>
                        </div>
                    )}
                </div>
            )}

            <div className="max-w-xl mx-auto p-4 space-y-6">

                {/* 1. DATA DIRI (The new order: Name -> Gender -> Phone -> Unit) */}
                <div className="bg-white p-5 rounded-xl shadow-sm space-y-4">
                    <h2 className="font-bold border-b pb-2 flex items-center gap-2 text-slate-700"><User size={20} /> Identitas Pemesan</h2>

                    {/* 1. Nama Anak */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">1. Nama Anak</label>
                        <input
                            className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition"
                            placeholder="Nama Lengkap Siswa"
                            value={identity.studentName}
                            onChange={e => setIdentity({ ...identity, studentName: e.target.value })}
                        />
                    </div>

                    {/* 2. Jenis Kelamin */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">2. Jenis Kelamin</label>
                        <div className="grid grid-cols-2 gap-3">
                            {['Ikhwan', 'Akhwat'].map(g => (
                                <button
                                    key={g}
                                    onClick={() => setIdentity({ ...identity, gender: g })}
                                    className={`py-2.5 rounded-lg font-bold border transition relative overflow-hidden ${identity.gender === g ?
                                        (g === 'Ikhwan' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-pink-600 text-white border-pink-600')
                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                                >
                                    {g}
                                    {identity.gender === g && <div className="absolute top-1 right-1"><Check size={12} /></div>}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 3. Nomor HP */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">3. Nomor HP (WA)</label>
                        <input
                            className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition"
                            placeholder="08xxxxxxxxxxx"
                            type="tel"
                            value={identity.phone}
                            onChange={e => setIdentity({ ...identity, phone: e.target.value })}
                        />
                    </div>

                    {/* 4. Unit Sekolah */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">4. Unit Sekolah</label>
                        <select
                            className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                            value={identity.unit}
                            onChange={e => setIdentity({ ...identity, unit: e.target.value })}
                        >
                            <option value="">-- Pilih Unit --</option>
                            {USERS_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                    </div>
                </div>

                {/* 5. ITEM ORDER SECTION */}
                <div className={`transition duration-300 ${!identity.unit ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                        <div className="bg-slate-800 text-white p-3 font-bold flex items-center gap-2">
                            <Shirt size={20} /> 5. Input Pesanan
                        </div>

                        {/* TABS */}
                        <div className="flex border-b">
                            {['Seragam', 'Peci'].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`flex-1 py-3 font-bold text-sm transition ${activeTab === tab ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50' : 'text-slate-500 hover:bg-slate-50'}`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        {/* CONTENT */}
                        <div className="p-5 space-y-4">
                            {activeTab === 'Seragam' ? (
                                <>
                                    {/* a1. Jenis Seragam (Group) */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">a1. Jenis Seragam</label>
                                        <select className="w-full border p-2 rounded" value={seragamGroup} onChange={e => setSeragamGroup(e.target.value)}>
                                            <option value="">-- Pilih Jenis --</option>
                                            {UNIFORM_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                                        </select>
                                    </div>

                                    {/* a2. Tipe */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">a2. Tipe</label>
                                        <select className="w-full border p-2 rounded" value={seragamType} onChange={e => setSeragamType(e.target.value)}>
                                            <option value="">-- Pilih Tipe --</option>
                                            {UNIFORM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>

                                    {/* a3. Ukuran */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">a3. Ukuran</label>
                                        <select className="w-full border p-2 rounded" value={seragamSize} onChange={e => setSeragamSize(e.target.value)}>
                                            <option value="">-- Pilih Ukuran --</option>
                                            {(seragamGroup.includes('Jubah') || seragamType.includes('Jubah') ? SIZES_JUBAH : SIZES_STD).map(s => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* a4. Jumlah */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">a4. Jumlah</label>
                                        <input type="number" min="1" className="w-24 border p-2 rounded text-center font-bold" value={seragamQty} onChange={e => setSeragamQty(parseInt(e.target.value) || 1)} />
                                    </div>
                                </>
                            ) : (
                                <>
                                    {/* Peci - Ukuran */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Ukuran Peci</label>
                                        <select className="w-full border p-2 rounded" value={peciSize} onChange={e => setPeciSize(e.target.value)}>
                                            <option value="">-- Pilih Ukuran --</option>
                                            {SIZES_PECI.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    {/* Peci - Jumlah */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Jumlah</label>
                                        <input type="number" min="1" className="w-24 border p-2 rounded text-center font-bold" value={peciQty} onChange={e => setPeciQty(parseInt(e.target.value) || 1)} />
                                    </div>
                                </>
                            )}

                            {/* ADD BUTTON */}
                            <div className="pt-2">
                                <button
                                    onClick={handleAddItem}
                                    className="w-full bg-slate-800 text-white py-3 rounded-lg font-bold hover:bg-slate-900 transition flex justify-center items-center gap-2"
                                >
                                    <Plus size={18} /> Tambahkan Pesanan
                                </button>
                                {/* Status Preview */}
                                {matchedItem && (
                                    <div className="mt-2 text-xs text-center">
                                        <span className={matchedItem.stock > 0 ? "text-green-600 font-bold" : "text-orange-600 font-bold"}>
                                            {matchedItem.stock > 0 ? "✅ Ready Stock" : "⏳ Pre-Order (Stok Habis)"}
                                        </span>
                                        <span className="text-slate-400 mx-1">•</span>
                                        <span>Rp {matchedItem.purchasePrice?.toLocaleString('id-ID')}</span>
                                    </div>
                                )}
                                {!matchedItem && identity.unit && (activeTab === 'Seragam' ? seragamType : peciSize) && (
                                    <div className="mt-2 text-xs text-center text-red-500 font-bold">
                                        ❌ Item tidak ditemukan di database
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* CART LIST */}
                {cart.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                        <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><ShoppingBag size={18} /> Daftar Pesanan ({cart.length})</h3>
                        <div className="space-y-3">
                            {cart.map((c, i) => (
                                <div key={i} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                                    <div>
                                        <div className="font-bold text-sm text-slate-800">{c.item.name}</div>
                                        <div className="text-xs text-slate-500">Ukuran: {c.item.size} • Qty: {c.quantity}</div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-bold text-slate-600">Rp {(c.item.purchasePrice * c.quantity).toLocaleString('id-ID')}</span>
                                        <button onClick={() => handleRemoveItem(c.itemId)} className="text-red-500 p-1 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-100">
                            <span className="font-bold text-slate-600">Total Estimasi</span>
                            <span className="font-bold text-xl text-indigo-700">Rp {cart.reduce((s, c) => s + (c.item.purchasePrice * c.quantity), 0).toLocaleString('id-ID')}</span>
                        </div>
                    </div>
                )}

            </div>

            {/* FLOATING SUBMIT BUTTON */}
            {cart.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg z-50">
                    <div className="max-w-xl mx-auto">
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-bold shadow-green-200 shadow-lg flex justify-center items-center gap-2 text-lg transform transition active:scale-95"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : <Save />} KIRIM PESANAN
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UniformOrderPage;
