import { useState, useMemo } from 'react';
import { ShoppingBag, Plus, Trash2, Save, Loader2, Check, User, Shirt } from 'lucide-react';

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
    // Note: Items are NO LONGER fetched from DB. We generate them locally.
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
    const [checkResult, setCheckResult] = useState(null);
    const [showCheck, setShowCheck] = useState(false);

    const API_BASE = window.location.origin.includes('localhost') ? 'http://localhost:5000' : '';

    // --- HANDLERS ---
    const handleAddItem = () => {
        let newItem = null;

        if (activeTab === 'Seragam') {
            if (!seragamGroup || !seragamType || !seragamSize) return alert('Lengkapi data seragam (Jenis, Tipe, Ukuran)');

            newItem = {
                id: Date.now(), // Temporary ID
                name: `Seragam ${seragamGroup} - ${seragamType}`,
                size: seragamSize,
                quantity: seragamQty,
                type: 'Seragam'
            };
        } else {
            if (!peciSize) return alert('Pilih ukuran Peci');

            newItem = {
                id: Date.now(),
                name: `Peci / Songkok`,
                size: peciSize,
                quantity: peciQty,
                type: 'Peci'
            };
        }

        setCart(prev => [...prev, newItem]);

        // Reset Inputs
        setSeragamGroup('');
        setSeragamType('');
        setSeragamSize('');
        setSeragamQty(1);
        setPeciSize('');
        setPeciQty(1);
    };

    const handleRemoveItem = (id) => setCart(prev => prev.filter(c => c.id !== id));

    const handleSubmit = async () => {
        // Validation
        if (!identity.studentName) return alert('Nama Anak wajib diisi');
        if (!identity.gender) return alert('Jenis Kelamin wajib dipilih');
        if (!identity.phone) return alert('Nomor HP wajib diisi');
        if (!identity.unit) return alert('Unit Sekolah wajib dipilih');

        // Check if there's a "pending" item in the inputs that wasn't added to the cart
        let finalCart = [...cart];
        let pendingItem = null;

        if (activeTab === 'Seragam') {
            if (seragamGroup && seragamType && seragamSize) {
                pendingItem = {
                    name: `Seragam ${seragamGroup} - ${seragamType}`,
                    size: seragamSize,
                    quantity: seragamQty
                };
            }
        } else {
            if (peciSize) {
                pendingItem = {
                    name: `Peci / Songkok`,
                    size: peciSize,
                    quantity: peciQty
                };
            }
        }

        if (pendingItem) {
            finalCart.push(pendingItem);
        }

        if (finalCart.length === 0) return alert('Keranjang pesanan kosong. Silakan pilih seragam/peci terlebih dahulu.');

        if (!confirm('Apakah data sudah benar? Kirim pesanan sekarang?')) return;

        setLoading(true);
        try {
            // Format Items into a String Note
            const itemNote = finalCart.map((c, i) => `${i + 1}. ${c.name} (${c.size}) x${c.quantity}`).join('\n');
            const fullNote = `GENDER: ${identity.gender}\n\nITEM PESANAN:\n${itemNote}`;

            const payload = {
                studentName: identity.studentName,
                customerPhone: identity.phone,
                customerUnit: identity.unit,
                customerName: '', // Optional
                items: [], // EMPTY ITEMS ARRAY -> Decoupled from DB
                note: fullNote,
                gender: identity.gender // Add Gender for WA
            };

            const res = await fetch(`${API_BASE}/api/uniform-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Gagal mengirim pesanan');

            // Custom Success Message
            alert(`Abu/Ummu ${identity.studentName} pesanannya telah kami terima. InsyaaAllah akan kami hubungi segera`);

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
                    <p className="text-slate-600">Simpan kode ini sebagai bukti pemesanan.</p>
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
                            {/* Display Note for decoupled orders */}
                            <div className="mt-2 text-xs bg-slate-100 p-2 rounded whitespace-pre-wrap font-mono">
                                {checkResult.note || 'Tidak ada detail item (Decoupled Mode)'}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="max-w-xl mx-auto p-4 space-y-6">

                {/* 1. DATA DIRI */}
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
                <div id="input-section" className={`transition duration-300 ${!identity.unit ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
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
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Jenis Seragam</label>
                                        <select className="w-full border p-2 rounded" value={seragamGroup} onChange={e => setSeragamGroup(e.target.value)}>
                                            <option value="">-- Pilih Jenis --</option>
                                            {UNIFORM_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                                        </select>
                                    </div>

                                    {/* a2. Tipe */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Tipe</label>
                                        <select className="w-full border p-2 rounded" value={seragamType} onChange={e => setSeragamType(e.target.value)}>
                                            <option value="">-- Pilih Tipe --</option>
                                            {UNIFORM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>

                                    {/* a3. Ukuran */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Ukuran</label>
                                        <select className="w-full border p-2 rounded" value={seragamSize} onChange={e => setSeragamSize(e.target.value)}>
                                            <option value="">-- Pilih Ukuran --</option>
                                            {(seragamGroup.includes('Jubah') || seragamType.includes('Jubah') ? SIZES_JUBAH : SIZES_STD).map(s => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* a4. Jumlah */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Jumlah</label>
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

                            {/* ACTION BUTTONS */}
                            <div className="pt-2 flex gap-3">
                                <button
                                    onClick={handleAddItem}
                                    className="flex-1 bg-slate-100 text-slate-700 py-3.5 rounded-lg font-bold hover:bg-slate-200 transition flex justify-center items-center gap-2"
                                >
                                    <Plus size={18} /> TAMBAH PESANAN
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={loading || cart.length === 0}
                                    className="flex-1 bg-green-600 text-white py-3.5 rounded-lg font-bold hover:bg-green-700 transition flex justify-center items-center gap-2 disabled:opacity-50 disabled:grayscale"
                                >
                                    {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} KIRIM PESANAN
                                </button>
                            </div>
                            <div className="mt-3 space-y-1">
                                <p className="text-[10px] text-center text-indigo-600 font-bold animate-pulse">
                                    💡 Jika ingin memesan lebih dari 1 item, silakan klik "TAMBAH PESANAN" untuk setiap item.
                                </p>
                                <p className="text-[10px] text-center text-slate-400 italic">
                                    * Pastikan semua item sudah masuk ke "Daftar Pesanan" sebelum klik Kirim Pesanan.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* CART LIST - Only visible if has items */}
                {cart.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2 border-b pb-2"><ShoppingBag size={18} className="text-indigo-600" /> Daftar Pesanan ({cart.length})</h3>
                        <div className="space-y-3">
                            {cart.map((c, i) => (
                                <div key={i} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                                    <div>
                                        <div className="font-bold text-sm text-slate-800">{c.name}</div>
                                        <div className="text-xs text-slate-500">Ukuran: {c.size} • Qty: {c.quantity}</div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => handleRemoveItem(c.id)} className="text-red-500 p-1.5 hover:bg-red-50 rounded-lg transition"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default UniformOrderPage;
