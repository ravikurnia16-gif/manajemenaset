import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, Plus, Trash2, ArrowLeft, Package, Search, ShoppingCart, Minus, X, Loader2 } from 'lucide-react';
import api from '../lib/axios';
import { getMediaUrl } from '../lib/media';

const UnitOrderForm = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [warehouseItems, setWarehouseItems] = useState([]);
    const [cart, setCart] = useState([]);
    const [itemSearch, setItemSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Semua');
    const [isCartOpen, setIsCartOpen] = useState(false);

    useEffect(() => {
        const fetchItems = async () => {
            try {
                const res = await api.get('/warehouse/items');
                setWarehouseItems(res.data);
            } catch (e) { console.error(e); }
        };
        fetchItems();
    }, []);

    // Filter out "seragam" globally for this page
    const baseItems = useMemo(() => {
        return warehouseItems.filter(i => !i.category?.name?.toLowerCase().includes('seragam'));
    }, [warehouseItems]);

    const categories = useMemo(() => {
        const cats = new Set(baseItems.map(i => i.category?.name).filter(Boolean));
        return ['Semua', ...Array.from(cats)];
    }, [baseItems]);

    const filteredItems = useMemo(() => {
        let items = baseItems;
        
        if (selectedCategory !== 'Semua') {
            items = items.filter(i => i.category?.name === selectedCategory);
        }

        if (itemSearch) {
            items = items.filter(i =>
                i.name?.toLowerCase().includes(itemSearch.toLowerCase()) ||
                i.code?.toLowerCase().includes(itemSearch.toLowerCase())
            );
        }
        return items;
    }, [itemSearch, selectedCategory, baseItems]);

    const handleAddToCart = (item) => {
        const existing = cart.find(c => c.itemId === item.id);
        if (existing) {
            setCart(cart.map(c => c.itemId === item.id ? { ...c, quantity: c.quantity + 1 } : c));
        } else {
            setCart([...cart, {
                id: Date.now() + Math.random(),
                name: item.name,
                size: item.size || '-',
                quantity: 1,
                type: 'LAINNYA',
                itemId: item.id,
                image: item.image,
                stock: item.stock
            }]);
        }
    };

    const handleUpdateQuantity = (itemId, delta) => {
        setCart(prev => prev.map(c => {
            if (c.itemId === itemId) {
                const newQ = c.quantity + delta;
                return newQ > 0 ? { ...c, quantity: newQ } : c;
            }
            return c;
        }));
    };

    const handleRemove = (id) => setCart(cart.filter(c => c.id !== id));

    const handleSubmit = async () => {
        if (cart.length === 0) return alert('Keranjang kosong!');
        try {
            setLoading(true);
            const userStore = localStorage.getItem('user');
            const user = userStore ? JSON.parse(userStore) : {};

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

    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

    return (
        <div className="min-h-screen bg-slate-50 pb-24 lg:pb-8">
            {/* Sticky Header */}
            <div className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition text-slate-600">
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex-1 max-w-2xl relative">
                        <input
                            type="text"
                            placeholder="Cari barang untuk unit..."
                            value={itemSearch}
                            onChange={e => setItemSearch(e.target.value)}
                            className="w-full bg-slate-100 border-transparent focus:bg-white focus:border-indigo-500 rounded-full py-2.5 pl-10 pr-4 text-sm outline-none transition-all ring-1 ring-transparent focus:ring-2 focus:ring-indigo-500"
                        />
                        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                    {/* Mobile Cart Toggle */}
                    <button 
                        className="lg:hidden p-2 relative text-slate-600 hover:bg-slate-100 rounded-full transition"
                        onClick={() => setIsCartOpen(true)}
                    >
                        <ShoppingCart size={24} />
                        {totalItems > 0 && (
                            <span className="absolute top-0 right-0 w-5 h-5 bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
                                {totalItems}
                            </span>
                        )}
                    </button>
                </div>
                
                {/* Category Pills */}
                <div className="max-w-7xl mx-auto px-4 py-3 overflow-x-auto custom-scrollbar flex gap-2">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-semibold transition-all border ${
                                selectedCategory === cat 
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-200' 
                                    : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-6">
                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Product Grid */}
                    <div className="flex-1">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                            {filteredItems.map(item => {
                                const inCart = cart.find(c => c.itemId === item.id);
                                return (
                                    <div key={item.id} className="bg-white rounded-xl overflow-hidden border border-slate-200 hover:border-indigo-300 hover:shadow-lg transition-all group flex flex-col h-full">
                                        <div className="aspect-square bg-slate-50 relative overflow-hidden flex items-center justify-center">
                                            {item.image ? (
                                                <img src={getMediaUrl(item.image)} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                    <Package size={48} strokeWidth={1} />
                                                </div>
                                            )}
                                            {item.stock <= item.minStock && (
                                                <div className="absolute top-2 left-2 bg-red-500/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-sm">
                                                    Sisa {item.stock}
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-3 flex flex-col flex-1">
                                            <div className="text-[10px] font-mono text-slate-400 mb-1 truncate">{item.code}</div>
                                            <h3 className="font-semibold text-xs sm:text-sm text-slate-800 line-clamp-2 mb-1" title={item.name}>
                                                {item.name} {item.itemUnit && `(${item.itemUnit})`}
                                            </h3>
                                            <div className="mt-auto pt-2 flex items-center justify-between">
                                                <div className="text-indigo-600 font-bold text-sm">
                                                    Stok: {item.stock}
                                                </div>
                                                {inCart ? (
                                                    <div className="bg-indigo-50 border border-indigo-100 rounded-lg flex items-center">
                                                        <button 
                                                            onClick={() => handleUpdateQuantity(item.id, -1)}
                                                            className="w-7 h-7 flex items-center justify-center text-indigo-600 hover:bg-indigo-100 rounded-l-lg transition"
                                                        >
                                                            <Minus size={14} />
                                                        </button>
                                                        <span className="w-6 text-center text-xs font-bold text-indigo-700">{inCart.quantity}</span>
                                                        <button 
                                                            onClick={() => handleUpdateQuantity(item.id, 1)}
                                                            className="w-7 h-7 flex items-center justify-center text-indigo-600 hover:bg-indigo-100 rounded-r-lg transition"
                                                        >
                                                            <Plus size={14} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button 
                                                        onClick={() => handleAddToCart(item)}
                                                        className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white flex items-center justify-center transition-colors"
                                                    >
                                                        <ShoppingCart size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {filteredItems.length === 0 && (
                            <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                                <Search size={48} className="mb-4 opacity-20" />
                                <p className="font-medium">Barang tidak ditemukan</p>
                            </div>
                        )}
                    </div>

                    {/* Desktop Cart Sidebar */}
                    <div className="hidden lg:block w-80 shrink-0">
                        <div className="sticky top-24 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[calc(100vh-120px)]">
                            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                    <ShoppingBag className="text-indigo-600" size={20} />
                                    Keranjang Unit
                                </h2>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                                {cart.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3 opacity-60">
                                        <ShoppingCart size={48} strokeWidth={1} />
                                        <p className="text-sm font-medium">Belum ada barang dipilih</p>
                                    </div>
                                ) : (
                                    cart.map(c => (
                                        <div key={c.id} className="flex gap-3">
                                            <div className="w-16 h-16 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                                                {c.image ? <img src={getMediaUrl(c.image)} alt={c.name} className="w-full h-full object-cover" /> : <Package className="w-full h-full p-3 text-slate-300" />}
                                            </div>
                                            <div className="flex-1 flex flex-col">
                                                <div className="font-semibold text-xs text-slate-800 line-clamp-2 leading-tight">{c.name}</div>
                                                <div className="mt-auto flex items-center justify-between">
                                                    <div className="flex items-center border border-slate-200 rounded-md bg-white">
                                                        <button onClick={() => { if(c.quantity === 1) handleRemove(c.id); else handleUpdateQuantity(c.itemId, -1); }} className="px-2 py-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"><Minus size={12}/></button>
                                                        <span className="px-2 text-xs font-bold text-slate-700 w-6 text-center">{c.quantity}</span>
                                                        <button onClick={() => handleUpdateQuantity(c.itemId, 1)} className="px-2 py-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"><Plus size={12}/></button>
                                                    </div>
                                                    <button onClick={() => handleRemove(c.id)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 size={14}/></button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                                <div className="flex justify-between items-center mb-4 text-sm font-bold text-slate-700">
                                    <span>Total Barang:</span>
                                    <span className="text-indigo-600 text-lg">{totalItems}</span>
                                </div>
                                <button
                                    onClick={handleSubmit}
                                    disabled={cart.length === 0 || loading}
                                    className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {loading ? <Loader2 className="animate-spin" size={20} /> : 'Kirim Pesanan Sekarang'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Cart Overlay */}
            {isCartOpen && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setIsCartOpen(false)}></div>
                    <div className="absolute right-0 top-0 bottom-0 w-[85%] max-w-sm bg-white shadow-2xl flex flex-col animate-in slide-in-from-right-full duration-300">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                <ShoppingBag className="text-indigo-600" size={20} />
                                Keranjang ({totalItems})
                            </h2>
                            <button onClick={() => setIsCartOpen(false)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {cart.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3 opacity-60">
                                    <ShoppingCart size={48} strokeWidth={1} />
                                    <p className="text-sm font-medium">Belum ada barang dipilih</p>
                                </div>
                            ) : (
                                cart.map(c => (
                                    <div key={c.id} className="flex gap-3">
                                        <div className="w-20 h-20 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                                            {c.image ? <img src={getMediaUrl(c.image)} alt={c.name} className="w-full h-full object-cover" /> : <Package className="w-full h-full p-4 text-slate-300" />}
                                        </div>
                                        <div className="flex-1 flex flex-col">
                                            <div className="font-semibold text-sm text-slate-800 line-clamp-2 leading-tight mb-2">{c.name}</div>
                                            <div className="mt-auto flex items-center justify-between">
                                                <div className="flex items-center border border-slate-200 rounded-md bg-white">
                                                    <button onClick={() => { if(c.quantity === 1) handleRemove(c.id); else handleUpdateQuantity(c.itemId, -1); }} className="px-3 py-1.5 text-slate-500 hover:text-indigo-600 active:bg-indigo-50"><Minus size={14}/></button>
                                                    <span className="px-3 text-sm font-bold text-slate-700 w-8 text-center">{c.quantity}</span>
                                                    <button onClick={() => handleUpdateQuantity(c.itemId, 1)} className="px-3 py-1.5 text-slate-500 hover:text-indigo-600 active:bg-indigo-50"><Plus size={14}/></button>
                                                </div>
                                                <button onClick={() => handleRemove(c.id)} className="text-slate-400 hover:text-red-500 p-2"><Trash2 size={18}/></button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-4 border-t border-slate-100 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                            <button
                                onClick={() => { setIsCartOpen(false); handleSubmit(); }}
                                disabled={cart.length === 0 || loading}
                                className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 text-lg"
                            >
                                {loading ? <Loader2 className="animate-spin" size={24} /> : `Kirim Pesanan (${totalItems})`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UnitOrderForm;
