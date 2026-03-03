import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, Plus, Trash2, Save, ArrowLeft, Shirt, Package, User, Check, Loader2, Search } from 'lucide-react';
import api from '../lib/axios';

const UNITS = ['TK', 'TAUD', 'MIT', 'SD', 'SMP', 'SMA', 'Pondok'];
const GENDERS = ['Ikhwan', 'Akhwat'];
const SIZES_STD = ['SS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL', 'Ukuran Khusus'];
const SIZES_JUBAH = ['38', '40', '42', '44', '46', '48', '50/20', '50/22', '50/24', '52/20', '52/22', '52/24', '54/20', '54/22', '54/24', 'Ukuran khusus'];

const UnitOrderForm = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [warehouseItems, setWarehouseItems] = useState([]);
    const [activeCategory, setActiveCategory] = useState('seragam'); // 'seragam' | 'lainnya'

    // Cart
    const [cart, setCart] = useState([]);

    // Seragam Input
    const [seragam, setSeragam] = useState({
        unit: '',
        gender: '',
        size: '',
        quantity: 1
    });

    // Lainnya Input
    const [other, setOther] = useState({
        itemId: '',
        itemName: '',
        image: '',
        quantity: 1
    });

    const [itemSearch, setItemSearch] = useState('');

    useEffect(() => {
        const fetchItems = async () => {
            try {
                const res = await api.get('/warehouse/items');
                setWarehouseItems(res.data);
            } catch (e) { console.error(e); }
        };
        fetchItems();
    }, []);

    const filteredItems = useMemo(() => {
        if (!itemSearch) return [];
        return warehouseItems.filter(i =>
            i.name?.toLowerCase().includes(itemSearch.toLowerCase()) ||
            i.code?.toLowerCase().includes(itemSearch.toLowerCase())
        ).slice(0, 5);
    }, [itemSearch, warehouseItems]);

    const handleAddSeragam = () => {
        if (!seragam.unit || !seragam.gender || !seragam.size) return alert('Lengkapi data seragam!');
        const newItem = {
            id: Date.now(),
            name: `Seragam ${seragam.unit} (${seragam.gender})`,
            size: seragam.size,
            quantity: seragam.quantity,
            type: 'SERAGAM',
            unit: seragam.unit,
            gender: seragam.gender
        };
        setCart([...cart, newItem]);
        // Reset size logic but keep unit and gender for convenience
        setSeragam({ ...seragam, size: '', quantity: 1 });
    };

    const handleAddOther = () => {
        if (!other.itemName) return alert('Pilih atau isi nama barang!');
        const newItem = {
            id: Date.now(),
            name: other.itemName,
            size: '-',
            quantity: other.quantity,
            type: 'LAINNYA',
            itemId: other.itemId || null
        };
        setCart([...cart, newItem]);
        setOther({ itemId: '', itemName: '', image: '', quantity: 1 });
        setItemSearch('');
    };

    const handleRemove = (id) => setCart(cart.filter(c => c.id !== id));

    const handleSubmit = async () => {
        if (cart.length === 0) return alert('Keranjang kosong!');

        try {
            setLoading(true);
            const userStore = localStorage.getItem('user');
            const user = userStore ? JSON.parse(userStore) : {};

            // Format for existing endpoint
            const itemNote = cart.map((c, i) => `${i + 1}. ${c.name} (${c.size}) x${c.quantity}`).join('\n');
            const fullNote = `PESANAN UNIT INTERNAL\n\nITEM PESANAN:\n${itemNote}`;

            const payload = {
                studentName: `PESANAN UNIT: ${user?.unit?.name || 'Internal'}`,
                customerPhone: user?.phone || '08',
                customerUnit: user?.unit?.name || 'Internal',
                customerName: user?.name || 'Admin Unit',
                note: fullNote,
                items: cart.map(c => ({
                    itemId: c.itemId,
                    name: c.name,
                    size: c.size,
                    quantity: c.quantity
                }))
            };

            await api.post('/uniform-order', payload);
            alert('Pesanan berhasil dikirim!');
            navigate('/gudang/pesanan');
        } catch (e) {
            console.error(e);
            alert('Gagal mengirim pesanan: ' + (e.response?.data?.error || e.message));
        } finally {
            setLoading(false);
        }
    };

    const sizes = seragam.unit === 'Pondok' ? SIZES_JUBAH : SIZES_STD;
    const isSpecialUnit = ['TK', 'TAUD', 'MIT'].includes(seragam.unit);

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-lg transition"><ArrowLeft size={20} /></button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Pesanan Unit</h1>
                    <p className="text-sm text-slate-500">Pesan seragam atau barang gudang lainnya untuk kebutuhan unit</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Form Section */}
                <div className="md:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6">
                        <div className="flex p-1 bg-slate-100 rounded-xl">
                            <button
                                onClick={() => setActiveCategory('seragam')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition ${activeCategory === 'seragam' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <Shirt size={18} /> Seragam
                            </button>
                            <button
                                onClick={() => setActiveCategory('lainnya')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition ${activeCategory === 'lainnya' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <Package size={18} /> Barang Lainnya
                            </button>
                        </div>

                        {activeCategory === 'seragam' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5 md:col-span-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5"><Check size={14} /> 1. Pilih Unit</label>
                                    <select
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={seragam.unit}
                                        onChange={e => setSeragam({ ...seragam, unit: e.target.value })}
                                    >
                                        <option value="">-- Pilih Unit --</option>
                                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                    {isSpecialUnit && <p className="text-[10px] text-orange-600 font-medium">Note: Data ukuran untuk unit ini masih dalam pengembangan.</p>}
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5"><User size={14} /> 2. Jenis Kelamin</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {GENDERS.map(g => (
                                            <button
                                                key={g}
                                                onClick={() => setSeragam({ ...seragam, gender: g })}
                                                className={`py-2.5 rounded-xl text-sm font-bold border transition ${seragam.gender === g ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-400'}`}
                                            >
                                                {g}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5"><Check size={14} /> 3. Ukuran</label>
                                    <select
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={seragam.size}
                                        onChange={e => setSeragam({ ...seragam, size: e.target.value })}
                                        disabled={!seragam.unit}
                                    >
                                        <option value="">-- Pilih Ukuran --</option>
                                        {sizes.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase">4. Jumlah</label>
                                    <input
                                        type="number"
                                        min="1"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                                        value={seragam.quantity}
                                        onChange={e => setSeragam({ ...seragam, quantity: parseInt(e.target.value) || 1 })}
                                    />
                                </div>
                                <div className="md:col-span-2 pt-2">
                                    <button onClick={handleAddSeragam} className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg flex items-center justify-center gap-2">
                                        <Plus size={20} /> Tambah ke Keranjang
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="space-y-1.5 relative">
                                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5"><Search size={14} /> Nama Barang</label>

                                    {!other.itemId ? (
                                        <input
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="Cari item dari stok gudang atau ketik manual..."
                                            value={itemSearch}
                                            onChange={e => {
                                                setItemSearch(e.target.value);
                                                setOther({ ...other, itemName: e.target.value, itemId: '' });
                                            }}
                                        />
                                    ) : (
                                        <div className="flex items-center gap-4 p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                                            {other.image ? (
                                                <div className="w-16 h-16 rounded-lg overflow-hidden border border-white shadow-sm flex-shrink-0">
                                                    <img src={other.image} alt="" className="w-full h-full object-cover" />
                                                </div>
                                            ) : (
                                                <div className="w-16 h-16 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-300 flex-shrink-0">
                                                    <Package size={24} />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-slate-800 truncate">{other.itemName}</div>
                                                <div className="text-[10px] text-slate-500">Item Terpilih</div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setOther({ ...other, itemId: '', itemName: '', image: '' });
                                                    setItemSearch('');
                                                }}
                                                className="p-1.5 hover:bg-white rounded-lg text-slate-400 hover:text-red-500 transition"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    )}

                                    {filteredItems.length > 0 && !other.itemId && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden border-t-0 animate-in slide-in-from-top-1">
                                            {filteredItems.map(item => (
                                                <button
                                                    key={item.id}
                                                    onClick={() => {
                                                        setOther({ ...other, itemName: item.name, itemId: item.id, image: item.image || '' });
                                                        setItemSearch('');
                                                    }}
                                                    className="w-full text-left p-3 text-sm hover:bg-slate-50 border-b border-slate-50 last:border-0 transition flex items-center gap-3"
                                                >
                                                    {item.image && (
                                                        <div className="w-8 h-8 rounded border border-slate-100 overflow-hidden flex-shrink-0">
                                                            <img src={item.image} alt="" className="w-full h-full object-cover" />
                                                        </div>
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-bold text-slate-700 truncate">{item.name}</div>
                                                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                            {item.code} {item.size ? `• Ukuran ${item.size}` : ''} • Stok: {item.stock}
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Jumlah</label>
                                    <input
                                        type="number"
                                        min="1"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                                        value={other.quantity}
                                        onChange={e => setOther({ ...other, quantity: parseInt(e.target.value) || 1 })}
                                    />
                                </div>
                                <div className="pt-2">
                                    <button onClick={handleAddOther} className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg flex items-center justify-center gap-2">
                                        <Plus size={20} /> Tambah ke Keranjang
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Cart Section */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-full min-h-[450px]">
                        <h3 className="font-bold text-slate-800 flex items-center justify-between border-b pb-4 mb-4">
                            <span className="flex items-center gap-2"><ShoppingBag size={20} className="text-indigo-600" /> Keranjang</span>
                            <span className="bg-indigo-50 text-indigo-600 text-xs px-2.5 py-1 rounded-full">{cart.length} Item</span>
                        </h3>

                        <div className="flex-1 space-y-3 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                            {cart.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 opacity-50 py-10">
                                    <ShoppingBag size={40} strokeWidth={1.5} />
                                    <p className="text-xs font-bold uppercase tracking-widest">Keranjang Kosong</p>
                                </div>
                            ) : cart.map(c => (
                                <div key={c.id} className="bg-slate-50 p-3 rounded-xl border border-slate-200 relative group animate-in slide-in-from-right-2">
                                    <button
                                        onClick={() => handleRemove(c.id)}
                                        className="absolute -top-2 -right-2 w-7 h-7 bg-white text-red-500 border border-slate-200 rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                    <div className="font-bold text-xs text-slate-800 line-clamp-2 pr-4">{c.name}</div>
                                    <div className="flex items-center justify-between mt-2">
                                        <span className="text-[10px] bg-white text-slate-500 px-2.5 py-1 rounded-lg border border-slate-100 font-medium">{c.size}</span>
                                        <span className="text-sm font-bold text-indigo-600">× {c.quantity}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="pt-6 mt-4 border-t border-slate-100">
                            <button
                                onClick={handleSubmit}
                                disabled={cart.length === 0 || loading}
                                className="w-full bg-green-600 text-white py-3.5 rounded-xl font-bold hover:bg-green-700 transition shadow-lg disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2 shadow-green-200"
                            >
                                {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />} KIRIM PESANAN
                            </button>
                            <p className="text-[10px] text-slate-400 text-center mt-3">* Pesanan akan otomatis tercatat dan diproses oleh admin gudang.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UnitOrderForm;
