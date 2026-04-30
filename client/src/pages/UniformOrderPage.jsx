import { useState, useMemo, useEffect } from 'react';
import { ShoppingBag, Plus, Trash2, Save, Loader2, Check, User, Shirt } from 'lucide-react';

const USERS_UNITS = ['SD', 'SMP', 'SMA', 'Pondok Putra', 'Pondok Putri'];

// --- CONFIGURATION V2 ---
const UNIFORM_LOGIC = {
    Ikhwan: {
        groups: ['Nasional', 'Muslim', 'Olahraga', 'Batik', 'Pramuka', 'Jubah'],
        types: {
            Nasional: ['Baju', 'Celana', 'Baju dan Celana'],
            Muslim: ['Baju', 'Celana', 'Baju dan Celana'],
            Batik: ['Baju', 'Celana', 'Baju dan Celana'],
            Pramuka: ['Baju', 'Celana', 'Baju dan Celana'],
            Olahraga: ['Baju', 'Celana', 'Baju dan Celana'],
            Jubah: ['Jubah Hitam', 'Jubah Putih']
        }
    },
    Akhwat: {
        groups: ['Nasional', 'Muslim', 'Olahraga', 'Batik', 'Pramuka'],
        types: {
            Nasional: ['Baju', 'Jilbab', 'Baju dan Jilbab'],
            Muslim: ['Baju', 'Jilbab', 'Baju dan Jilbab'],
            Batik: ['Baju', 'Jilbab', 'Baju dan Jilbab'],
            Pramuka: ['Baju', 'Jilbab', 'Baju dan Jilbab'],
            Olahraga: ['Baju', 'Jilbab', 'Rok Celana', 'Baju dan Jilbab dan Rok Celana']
        }
    }
};

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

    // Nama State
    const [namaText, setNamaText] = useState('');
    const [namaQty, setNamaQty] = useState(1);

    // Sync studentName to namaText if namaText is empty
    useEffect(() => {
        if (!namaText && identity.studentName) {
            setNamaText(identity.studentName);
        }
    }, [identity.studentName]);

    // Reset Dependent Selection on Gender/Group change
    useEffect(() => {
        setSeragamGroup('');
        setSeragamType('');
    }, [identity.gender]);

    useEffect(() => {
        setSeragamType('');
    }, [seragamGroup]);

    // Memoized Filtered Options
    const availableGroups = useMemo(() => {
        if (!identity.gender) return [];
        return UNIFORM_LOGIC[identity.gender]?.groups || [];
    }, [identity.gender]);

    const availableTypes = useMemo(() => {
        if (!identity.gender || !seragamGroup) return [];
        return UNIFORM_LOGIC[identity.gender]?.types[seragamGroup] || [];
    }, [identity.gender, seragamGroup]);

    // System
    const [orderResult, setOrderResult] = useState(null);
    const [checkCode, setCheckCode] = useState('');
    const [checkResult, setCheckResult] = useState(null);
    const [showCheck, setShowCheck] = useState(false);
    const [searchQuery, setSearchQuery] = useState({ name: '', phone: '' });
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [searchMode, setSearchMode] = useState('code'); // 'code' | 'name'

    const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1') ? 'http://localhost:5000' : '';

    // --- HANDLERS ---
    const handleAddItem = () => {
        if (activeTab === 'Seragam') {
            if (!seragamGroup || !seragamType || !seragamSize) return alert('Lengkapi data seragam (Jenis, Tipe, Ukuran)');

            // Split composite items (e.g., "Baju dan Celana")
            let types = [seragamType];
            if (seragamType.includes(' dan ')) {
                types = seragamType.split(' dan ');
            } else if (seragamType.includes(', ') && seragamType.includes(' dan ')) {
                // For "Baju, Rok Celana dan Jilbab"
                types = seragamType.split(/, | dan /);
            }

            const newItems = types.map((t, idx) => ({
                id: Date.now() + idx, // Unique temporary ID
                name: `Seragam ${seragamGroup} - ${t.trim()}`,
                size: seragamSize,
                quantity: seragamQty,
                type: 'Seragam'
            }));

            setCart(prev => [...prev, ...newItems]);
        } else if (activeTab === 'Peci') {
            if (!peciSize) return alert('Pilih ukuran Peci');

            const newPeci = {
                id: Date.now(),
                name: `Peci / Songkok`,
                size: peciSize,
                quantity: peciQty,
                type: 'Peci'
            };
            setCart(prev => [...prev, newPeci]);
        } else if (activeTab === 'Nama') {
            if (!namaText) return alert('Isi teks nama');

            const newNama = {
                id: Date.now(),
                name: `Nama Dada: ${namaText}`,
                size: 'Set',
                quantity: namaQty,
                type: 'Nama'
            };
            setCart(prev => [...prev, newNama]);
        }

        // Reset Inputs
        setSeragamGroup('');
        setSeragamType('');
        setSeragamSize('');
        setSeragamQty(1);
        setPeciSize('');
        setPeciQty(1);
        setNamaText(identity.studentName); // Reset to studentName
        setNamaQty(1);
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
                // Split composite items if any
                let types = [seragamType];
                if (seragamType.includes(' dan ')) {
                    types = seragamType.split(' dan ');
                } else if (seragamType.includes(', ') && seragamType.includes(' dan ')) {
                    types = seragamType.split(/, | dan /);
                }

                types.forEach(t => {
                    finalCart.push({
                        name: `Seragam ${seragamGroup} - ${t.trim()}`,
                        size: seragamSize,
                        quantity: seragamQty
                    });
                });
            }
        } else if (activeTab === 'Peci') {
            if (peciSize) {
                finalCart.push({
                    name: `Peci / Songkok`,
                    size: peciSize,
                    quantity: peciQty
                });
            }
        } else if (activeTab === 'Nama') {
            if (namaText) {
                finalCart.push({
                    name: `Nama Dada: ${namaText}`,
                    size: 'Set',
                    quantity: namaQty
                });
            }
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
                note: fullNote,
                gender: identity.gender, // Add Gender for WA
                items: finalCart.map(c => ({
                    name: c.name,
                    size: c.size,
                    quantity: c.quantity,
                    price: 0
                }))
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
                    <div className="flex gap-2 mb-4 bg-white/50 p-1 rounded-lg w-fit mx-auto">
                        <button 
                            onClick={() => { setSearchMode('code'); setCheckResult(null); setSearchResults([]); }}
                            className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition ${searchMode === 'code' ? 'bg-indigo-600 text-white shadow' : 'text-indigo-600'}`}
                        >Cek Kode</button>
                        <button 
                            onClick={() => { setSearchMode('name'); setCheckResult(null); setSearchResults([]); }}
                            className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition ${searchMode === 'name' ? 'bg-indigo-600 text-white shadow' : 'text-indigo-600'}`}
                        >Lupa Kode? Cari Nama</button>
                    </div>

                    {searchMode === 'code' ? (
                        <div className="flex gap-2 mb-2">
                            <input value={checkCode} onChange={e => setCheckCode(e.target.value.toUpperCase())} placeholder="Kode Pesanan" className="border p-2 rounded w-full text-sm" />
                            <button onClick={async () => {
                                if (!checkCode) return alert('Isi kode');
                                setSearching(true);
                                try {
                                    const res = await fetch(`${API_BASE}/api/uniform-order/check/${checkCode}`);
                                    const d = await res.json();
                                    if (!res.ok) throw new Error(d.error);
                                    setCheckResult(d);
                                } catch (e) { alert(e.message); } finally { setSearching(false); }
                            }} className="bg-indigo-600 text-white px-4 rounded text-sm font-bold disabled:opacity-50">
                                {searching ? '...' : 'Cari'}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2 mb-2">
                            <input 
                                value={searchQuery.name} 
                                onChange={e => setSearchQuery({...searchQuery, name: e.target.value})} 
                                placeholder="Nama Siswa" 
                                className="border p-2 rounded w-full text-sm" 
                            />
                            <div className="flex gap-2">
                                <input 
                                    value={searchQuery.phone} 
                                    onChange={e => setSearchQuery({...searchQuery, phone: e.target.value})} 
                                    placeholder="No HP (WA)" 
                                    className="border p-2 rounded w-full text-sm" 
                                />
                                <button onClick={async () => {
                                    if (!searchQuery.name || !searchQuery.phone) return alert('Isi Nama & No HP');
                                    setSearching(true);
                                    try {
                                        const res = await fetch(`${API_BASE}/api/uniform-order/search-public?name=${searchQuery.name}&phone=${searchQuery.phone}`);
                                        const d = await res.json();
                                        if (!res.ok) throw new Error(d.error);
                                        setSearchResults(d);
                                        if(d.length === 0) alert('Pesanan tidak ditemukan');
                                    } catch (e) { alert(e.message); } finally { setSearching(false); }
                                }} className="bg-indigo-600 text-white px-4 rounded text-sm font-bold whitespace-nowrap disabled:opacity-50">
                                    {searching ? '...' : 'Cari Pesanan'}
                                </button>
                            </div>
                        </div>
                    )}

                    {(checkResult || searchResults.length > 0) && (
                        <div className="space-y-3 max-h-[300px] overflow-auto">
                            {(checkResult ? [checkResult] : searchResults).map(res => (
                                <div key={res.id} className="bg-white p-3 rounded border text-sm shadow-sm">
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="font-bold text-indigo-600 font-mono">{res.code}</div>
                                        <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                            res.status === 'READY' ? 'bg-green-100 text-green-700 border-green-200' :
                                            res.status === 'PICKED_UP' || res.status === 'DONE' ? 'bg-slate-100 text-slate-500 border-slate-200' :
                                            'bg-yellow-100 text-yellow-700 border-yellow-200'
                                        }`}>
                                            {res.status}
                                        </div>
                                    </div>
                                    <div className="font-bold text-slate-800">{res.studentName}</div>
                                    <div className="text-xs text-slate-500 mb-2">{new Date(res.createdAt).toLocaleDateString('id-ID', { dateStyle: 'medium' })}</div>
                                    
                                    <div className="text-[10px] bg-slate-50 p-2 rounded whitespace-pre-wrap font-mono text-slate-600 border border-slate-100">
                                        {res.note?.includes('ITEM PESANAN:') ? res.note.split('ITEM PESANAN:')[1].trim() : (res.note || 'Detail item tidak tersedia')}
                                    </div>
                                </div>
                            ))}
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
                            {['Seragam', 'Peci', 'Nama'].map(tab => (
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
                                            {availableGroups.map(g => <option key={g} value={g}>{g}</option>)}
                                        </select>
                                    </div>

                                    {/* a2. Tipe */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Tipe</label>
                                        <select className="w-full border p-2 rounded" value={seragamType} onChange={e => setSeragamType(e.target.value)}>
                                            <option value="">-- Pilih Tipe --</option>
                                            {availableTypes.map(t => <option key={t} value={t}>{t}</option>)}
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
                            ) : activeTab === 'Peci' ? (
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
                            ) : (
                                <>
                                    {/* Nama - Teks */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Teks Nama Dada</label>
                                        <input
                                            type="text"
                                            className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="Contoh: AISYAH AZ-ZAHRA"
                                            value={namaText}
                                            onChange={e => setNamaText(e.target.value)}
                                        />
                                        <p className="text-[10px] text-slate-400 mt-1">* Pastikan ejaan nama sudah benar.</p>
                                    </div>
                                    {/* Nama - Jumlah */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Jumlah</label>
                                        <input type="number" min="1" className="w-24 border p-2 rounded text-center font-bold" value={namaQty} onChange={e => setNamaQty(parseInt(e.target.value) || 1)} />
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
