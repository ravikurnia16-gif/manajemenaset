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
        quantity: 1,
        studentName: '',
        types: []
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

    const uniformTypes = useMemo(() => {
        const types = new Set();
        warehouseItems.forEach(item => {
            // Only take from category ID 1 (Seragam) and use the item name
            if (item.categoryId === 1 && item.name) {
                types.add(item.name);
            }
        });

        const sorted = Array.from(types).sort();
        return sorted;
    }, [warehouseItems]);

    const filteredItems = useMemo(() => {
        let items = warehouseItems.filter(i => 
            !i.category?.name?.toLowerCase().includes('seragam')
        );
        if (itemSearch) {
            items = items.filter(i =>
                i.name?.toLowerCase().includes(itemSearch.toLowerCase()) ||
                i.code?.toLowerCase().includes(itemSearch.toLowerCase())
            );
        }
        // Jika pencarian kosong, tampilkan semua item (limit 48 supaya tidak berat dirender sekaligus)
        return items.slice(0, 48);
    }, [itemSearch, warehouseItems]);

    const handleAddSeragam = () => {
        if (!seragam.unit || !seragam.gender || !seragam.size) return alert('Lengkapi data unit, gender, dan ukuran!');
        if (seragam.types.length === 0) return alert('Pilih minimal satu tipe seragam!');
        if (!seragam.studentName) return alert('Isi nama siswa!');

        const newItems = seragam.types.map(type => ({
            id: Date.now() + Math.random(),
            name: `${type} ${seragam.unit} (${seragam.gender}) - ${seragam.studentName}`,
            size: seragam.size,
            quantity: seragam.quantity,
            type: 'SERAGAM',
            unit: seragam.unit,
            gender: seragam.gender,
            studentName: seragam.studentName
        }));

        setCart([...cart, ...newItems]);
        // Reset specific fields but keep unit/gender/name for mass entry convenience
        setSeragam({ ...seragam, size: '', types: [] });
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
                                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5"><User size={14} /> 1. Nama Siswa</label>
                                    <input
                                        type="text"
                                        placeholder="Ketik nama lengkap siswa..."
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={seragam.studentName}
                                        onChange={e => setSeragam({ ...seragam, studentName: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5 md:col-span-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5"><Check size={14} /> 2. Pilih Unit</label>
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
                                <div className="space-y-1.5 ">
                                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5"><User size={14} /> 3. Jenis Kelamin</label>
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
                                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5"><Check size={14} /> 4. Ukuran</label>
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
                                <div className="space-y-3 md:col-span-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5"><Shirt size={14} /> 5. Tipe Seragam (Ceklis yang dipesan)</label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {uniformTypes.length > 0 ? uniformTypes.map(type => (
                                            <button
                                                key={type}
                                                onClick={() => {
                                                    const newTypes = seragam.types.includes(type)
                                                        ? seragam.types.filter(t => t !== type)
                                                        : [...seragam.types, type];
                                                    setSeragam({ ...seragam, types: newTypes });
                                                }}
                                                className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all ${seragam.types.includes(type) ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm' : 'bg-white border-slate-100 text-slate-600 hover:border-slate-300'}`}
                                            >
                                                <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${seragam.types.includes(type) ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-slate-50'}`}>
                                                    {seragam.types.includes(type) && <Check size={10} strokeWidth={4} />}
                                                </div>
                                                {type}
                                            </button>
                                        )) : (
                                            <div className="col-span-2 py-3 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-[10px] text-slate-400">
                                                Belum ada data tipe seragam di gudang.
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-1.5 md:col-span-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">6. Jumlah per Tipe</label>
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
                            <div className="space-y-5">
                                <div className="space-y-1.5 relative">
                                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5"><Search size={14} /> Cari Barang</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="Ketik nama atau kode barang..."
                                        value={itemSearch}
                                        onChange={e => setItemSearch(e.target.value)}
                                    />
                                </div>

                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto pr-1 pb-4 custom-scrollbar">
                                    {filteredItems.map(item => {
                                        const inCart = cart.find(c => c.itemId === item.id);
                                        return (
                                            <div key={item.id} className={`bg-white border rounded-xl p-3 flex flex-col gap-2 transition-all ${inCart ? 'border-indigo-400 ring-1 ring-indigo-400 shadow-md' : 'border-slate-200 hover:border-indigo-300 hover:shadow-sm'}`}>
                                                <div className="aspect-square bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100 overflow-hidden relative">
                                                    {item.image ? (
                                                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <Package size={32} className="text-slate-300" />
                                                    )}
                                                    {item.stock <= item.minStock && (
                                                        <div className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                                                            Sisa {item.stock}
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                <div className="flex-1 min-w-0 flex flex-col">
                                                    <div className="text-[10px] font-mono text-indigo-600 mb-0.5">{item.code}</div>
                                                    <div className="font-bold text-xs text-slate-800 leading-tight mb-1 line-clamp-2" title={item.name}>
                                                        {item.name} {item.itemUnit && <span className="text-slate-500 font-bold">({item.itemUnit})</span>}
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 mt-auto flex items-center justify-between">
                                                        <span>Stok: <strong className="text-slate-700">{item.stock}</strong></span>
                                                        {item.size && <span>Ukr: <strong>{item.size}</strong></span>}
                                                    </div>
                                                </div>

                                                <div className="pt-2 border-t border-slate-100 mt-1">
                                                    {inCart ? (
                                                        <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-lg p-1">
                                                            <button 
                                                                onClick={() => {
                                                                    if (inCart.quantity === 1) handleRemove(inCart.id);
                                                                    else setCart(cart.map(c => c.id === inCart.id ? { ...c, quantity: c.quantity - 1 } : c));
                                                                }}
                                                                className="w-7 h-7 flex items-center justify-center bg-white text-indigo-600 rounded shadow-sm font-bold text-lg hover:bg-slate-50 leading-none"
                                                            >−</button>
                                                            <span className="text-sm font-bold text-indigo-700 w-8 text-center">{inCart.quantity}</span>
                                                            <button 
                                                                onClick={() => setCart(cart.map(c => c.id === inCart.id ? { ...c, quantity: c.quantity + 1 } : c))}
                                                                className="w-7 h-7 flex items-center justify-center bg-indigo-600 text-white rounded shadow-sm font-bold text-lg hover:bg-indigo-700 leading-none"
                                                            >+</button>
                                                        </div>
                                                    ) : (
                                                        <button 
                                                            onClick={() => {
                                                                const newItem = {
                                                                    id: Date.now() + Math.random(),
                                                                    name: item.name,
                                                                    size: item.size || '-',
                                                                    quantity: 1,
                                                                    type: 'LAINNYA',
                                                                    itemId: item.id
                                                                };
                                                                setCart([...cart, newItem]);
                                                            }}
                                                            className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition"
                                                        >
                                                            <Plus size={14} /> Keranjang
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {filteredItems.length === 0 && (
                                        <div className="col-span-2 lg:col-span-3 py-10 text-center text-slate-400">
                                            <Package size={32} className="mx-auto mb-2 opacity-50" />
                                            <p className="text-sm">Tidak ada barang yang cocok.</p>
                                        </div>
                                    )}
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
