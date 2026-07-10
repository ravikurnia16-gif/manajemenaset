import { useState, useEffect, useCallback } from 'react';
import { Shirt, Search, Filter, Plus, Package, Users, TrendingUp, AlertCircle, ChevronDown, CheckCircle2, Clock, Warehouse, ArrowLeftRight, ShoppingCart, BarChart3, Tag, Boxes, X, RefreshCw, Trash2, Edit, Eye } from 'lucide-react';
import api from '../lib/axios';

// ========== SUB COMPONENTS ==========

const StatCard = ({ title, value, icon, color, sub }) => (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-white/0 to-slate-50 rounded-bl-full -mr-2 -mt-2 transition-transform group-hover:scale-125" />
        <div className="flex items-center gap-4 relative z-10">
            <div className={`${color} text-white p-3 rounded-xl shadow-inner`}>{icon}</div>
            <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{title}</p>
                <h3 className="text-2xl font-extrabold text-slate-800 mt-0.5">{value}</h3>
                {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
            </div>
        </div>
    </div>
);

const Badge = ({ children, color = 'slate' }) => {
    const colors = {
        green: 'bg-green-50 text-green-600 border-green-200',
        red: 'bg-red-50 text-red-600 border-red-200',
        blue: 'bg-blue-50 text-blue-600 border-blue-200',
        orange: 'bg-orange-50 text-orange-600 border-orange-200',
        purple: 'bg-purple-50 text-purple-600 border-purple-200',
        slate: 'bg-slate-50 text-slate-600 border-slate-200',
        indigo: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    };
    return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${colors[color]}`}>{children}</span>;
};

const Modal = ({ isOpen, onClose, title, children, wide }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className={`bg-white rounded-2xl shadow-2xl ${wide ? 'max-w-3xl' : 'max-w-lg'} w-full max-h-[90vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
                    <h2 className="text-lg font-bold text-slate-800">{title}</h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"><X size={18} /></button>
                </div>
                <div className="p-5">{children}</div>
            </div>
        </div>
    );
};

const InputField = ({ label, ...props }) => (
    <div>
        <label className="block text-xs font-bold text-slate-500 mb-1.5">{label}</label>
        <input className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all" {...props} />
    </div>
);

const SelectField = ({ label, children, ...props }) => (
    <div>
        <label className="block text-xs font-bold text-slate-500 mb-1.5">{label}</label>
        <select className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all bg-white" {...props}>
            {children}
        </select>
    </div>
);

const TABS = [
    { key: 'dashboard', label: 'Dashboard', icon: <BarChart3 size={16} /> },
    { key: 'items', label: 'Data Barang', icon: <Shirt size={16} /> },
    { key: 'stock', label: 'Stok Gudang', icon: <Boxes size={16} /> },
    { key: 'packages', label: 'Paket SPMB', icon: <Package size={16} /> },
    { key: 'sales', label: 'Penjualan', icon: <ShoppingCart size={16} /> },
    { key: 'vendors', label: 'Vendor', icon: <Users size={16} /> },
    { key: 'transactions', label: 'Transaksi Stok', icon: <ArrowLeftRight size={16} /> },
    { key: 'exchanges', label: 'Tukar Ukuran', icon: <RefreshCw size={16} /> },
];

// ========== MAIN COMPONENT ==========

const UniformManagement = () => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [stats, setStats] = useState({});
    const [warehouses, setWarehouses] = useState([]);
    const [categories, setCategories] = useState([]);
    const [items, setItems] = useState([]);
    const [stocks, setStocks] = useState([]);
    const [packages, setPackages] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [sales, setSales] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [exchanges, setExchanges] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedWarehouse, setSelectedWarehouse] = useState('');
    const [modal, setModal] = useState({ open: false, type: '', data: null });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [whRes, catRes] = await Promise.all([
                api.get('/uniforms/warehouses'),
                api.get('/uniforms/categories')
            ]);
            setWarehouses(whRes.data);
            setCategories(catRes.data);

            if (activeTab === 'dashboard') {
                const r = await api.get('/uniforms/dashboard');
                setStats(r.data);
            } else if (activeTab === 'items') {
                const r = await api.get('/uniforms/items', { params: { search } });
                setItems(r.data);
            } else if (activeTab === 'stock') {
                const r = await api.get('/uniforms/stocks', { params: { warehouseId: selectedWarehouse || undefined, search } });
                setStocks(r.data);
            } else if (activeTab === 'packages') {
                const r = await api.get('/uniforms/packages');
                setPackages(r.data);
            } else if (activeTab === 'vendors') {
                const r = await api.get('/uniforms/vendors');
                setVendors(r.data);
            } else if (activeTab === 'sales') {
                const r = await api.get('/uniforms/sales', { params: { search } });
                setSales(r.data);
            } else if (activeTab === 'transactions') {
                const r = await api.get('/uniforms/transactions', { params: { warehouseId: selectedWarehouse || undefined } });
                setTransactions(r.data);
            } else if (activeTab === 'exchanges') {
                const r = await api.get('/uniforms/exchanges');
                setExchanges(r.data);
            }
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [activeTab, search, selectedWarehouse]);

    useEffect(() => {
        const t = setTimeout(fetchData, 300);
        return () => clearTimeout(t);
    }, [fetchData]);

    const openModal = (type, data = null) => setModal({ open: true, type, data });
    const closeModal = () => setModal({ open: false, type: '', data: null });

    // ========== FORM HANDLERS ==========

    const handleSaveWarehouse = async (formData) => {
        try {
            if (formData.id) {
                await api.put(`/uniforms/warehouses/${formData.id}`, formData);
            } else {
                await api.post('/uniforms/warehouses', formData);
            }
            closeModal();
            fetchData();
        } catch (err) {
            alert(err.response?.data?.error || 'Gagal menyimpan');
        }
    };

    const handleSaveCategory = async (formData) => {
        try {
            if (formData.id) {
                await api.put(`/uniforms/categories/${formData.id}`, formData);
            } else {
                await api.post('/uniforms/categories', formData);
            }
            closeModal();
            fetchData();
        } catch (err) {
            alert(err.response?.data?.error || 'Gagal menyimpan');
        }
    };

    const handleSaveItem = async (formData) => {
        try {
            if (formData.id) {
                await api.put(`/uniforms/items/${formData.id}`, formData);
            } else {
                await api.post('/uniforms/items', formData);
            }
            closeModal();
            fetchData();
        } catch (err) {
            alert(err.response?.data?.error || 'Gagal menyimpan');
        }
    };

    const handleSaveVendor = async (formData) => {
        try {
            if (formData.id) {
                await api.put(`/uniforms/vendors/${formData.id}`, formData);
            } else {
                await api.post('/uniforms/vendors', formData);
            }
            closeModal();
            fetchData();
        } catch (err) {
            alert(err.response?.data?.error || 'Gagal menyimpan');
        }
    };

    const handleSaveTransaction = async (formData) => {
        try {
            await api.post('/uniforms/transactions', formData);
            closeModal();
            fetchData();
        } catch (err) {
            alert(err.response?.data?.error || 'Gagal menyimpan transaksi');
        }
    };

    const handleSavePackage = async (formData) => {
        try {
            if (formData.id) {
                await api.put(`/uniforms/packages/${formData.id}`, formData);
            } else {
                await api.post('/uniforms/packages', formData);
            }
            closeModal();
            fetchData();
        } catch (err) {
            alert(err.response?.data?.error || 'Gagal menyimpan');
        }
    };

    // ========== RENDER TABS ==========

    const renderDashboard = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Total Item" value={stats.totalItems || 0} icon={<Shirt size={20} />} color="bg-blue-500" sub={`${stats.totalVariants || 0} variasi ukuran`} />
                <StatCard title="Total Stok" value={(stats.totalStock || 0).toLocaleString('id-ID')} icon={<Package size={20} />} color="bg-green-500" sub={`${stats.warehouses || 0} gudang aktif`} />
                <StatCard title="Stok Menipis" value={stats.lowStockCount || 0} icon={<AlertCircle size={20} />} color="bg-orange-500" sub="Perlu restock" />
                <StatCard title="Penjualan" value={stats.totalSales || 0} icon={<ShoppingCart size={20} />} color="bg-purple-500" sub={`${stats.pendingSales || 0} pending`} />
            </div>

            {stats.lowStockItems && stats.lowStockItems.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex items-center gap-2">
                        <AlertCircle size={16} className="text-orange-500" />
                        <h3 className="font-bold text-slate-700 text-sm">Peringatan Stok Menipis</h3>
                    </div>
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                            <tr>
                                <th className="p-3 text-left">Barang</th>
                                <th className="p-3 text-center">Ukuran</th>
                                <th className="p-3 text-center">Gudang</th>
                                <th className="p-3 text-center">Stok</th>
                                <th className="p-3 text-center">Min</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {stats.lowStockItems.map((s, i) => (
                                <tr key={i} className="hover:bg-slate-50">
                                    <td className="p-3 font-bold text-slate-800">{s.itemName}</td>
                                    <td className="p-3 text-center"><Badge>{s.size}</Badge></td>
                                    <td className="p-3 text-center text-slate-500 text-xs">{s.warehouseName}</td>
                                    <td className="p-3 text-center"><span className="text-red-600 font-extrabold">{Number(s.quantity)}</span></td>
                                    <td className="p-3 text-center text-slate-400">{Number(s.minStock)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );

    const renderItems = () => (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input type="text" placeholder="Cari nama atau kode barang..." className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-100" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <button onClick={() => openModal('category')} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors">
                    <Tag size={14} /> Kategori
                </button>
                <button onClick={() => openModal('warehouse')} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors">
                    <Warehouse size={14} /> Gudang
                </button>
                <button onClick={() => openModal('item')} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-blue-500/20 transition-all">
                    <Plus size={14} /> Tambah Barang
                </button>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                        <tr>
                            <th className="p-3 text-left">Kode</th>
                            <th className="p-3 text-left">Nama Barang</th>
                            <th className="p-3 text-center">Kategori</th>
                            <th className="p-3 text-center">Jenjang</th>
                            <th className="p-3 text-center">Ukuran Tersedia</th>
                            <th className="p-3 text-right">Harga Jual</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan="6" className="p-8 text-center text-slate-400">Memuat data...</td></tr>
                        ) : items.length === 0 ? (
                            <tr><td colSpan="6" className="p-8 text-center text-slate-400">Belum ada data barang. Klik "Tambah Barang" untuk memulai.</td></tr>
                        ) : items.map(item => (
                            <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                                <td className="p-3 font-mono text-xs text-slate-400">{item.code}</td>
                                <td className="p-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 shrink-0"><Shirt size={18} /></div>
                                        <div>
                                            <div className="font-bold text-slate-800">{item.name}</div>
                                            <div className="text-[10px] text-slate-400">{item.gender === 'L' ? 'Laki-laki' : item.gender === 'P' ? 'Perempuan' : 'Unisex'} • {item.type || '-'}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-3 text-center"><Badge color="indigo">{item.category?.name}</Badge></td>
                                <td className="p-3 text-center"><Badge>{item.targetUnit || '-'}</Badge></td>
                                <td className="p-3 text-center">
                                    <div className="flex flex-wrap gap-1 justify-center">
                                        {item.variants?.map(v => {
                                            const totalStock = v.stocks?.reduce((s, st) => s + st.quantity, 0) || 0;
                                            return <span key={v.id} className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${totalStock <= 0 ? 'bg-red-50 text-red-500 border-red-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{v.size} ({totalStock})</span>;
                                        })}
                                    </div>
                                </td>
                                <td className="p-3 text-right font-bold text-slate-700">Rp {(item.sellPrice || 0).toLocaleString('id-ID')}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderStock = () => (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input type="text" placeholder="Cari nama barang atau SKU..." className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-100" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white outline-none" value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)}>
                    <option value="">Semua Gudang</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                <button onClick={() => openModal('transaction')} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-blue-500/20">
                    <Plus size={14} /> Transaksi Stok
                </button>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                        <tr>
                            <th className="p-3 text-left">SKU</th>
                            <th className="p-3 text-left">Barang</th>
                            <th className="p-3 text-center">Ukuran</th>
                            <th className="p-3 text-center">Gudang</th>
                            <th className="p-3 text-center">Stok</th>
                            <th className="p-3 text-center">Min</th>
                            <th className="p-3 text-right">HPP</th>
                            <th className="p-3 text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan="8" className="p-8 text-center text-slate-400">Memuat data...</td></tr>
                        ) : stocks.length === 0 ? (
                            <tr><td colSpan="8" className="p-8 text-center text-slate-400">Belum ada data stok.</td></tr>
                        ) : stocks.map(s => (
                            <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="p-3 font-mono text-xs text-slate-400">{s.variant?.sku}</td>
                                <td className="p-3 font-bold text-slate-800">{s.variant?.item?.name}</td>
                                <td className="p-3 text-center"><Badge>{s.variant?.size}</Badge></td>
                                <td className="p-3 text-center text-xs text-slate-500">{s.warehouse?.name}</td>
                                <td className="p-3 text-center"><span className={`font-extrabold text-lg ${s.quantity <= s.minStock ? 'text-red-500' : 'text-slate-700'}`}>{s.quantity}</span></td>
                                <td className="p-3 text-center text-slate-400">{s.minStock}</td>
                                <td className="p-3 text-right text-slate-600">Rp {(s.avgCost || 0).toLocaleString('id-ID')}</td>
                                <td className="p-3 text-center">
                                    {s.quantity <= 0 ? <Badge color="red">Habis</Badge> : s.quantity <= s.minStock ? <Badge color="orange">Menipis</Badge> : <Badge color="green">Aman</Badge>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderPackages = () => (
        <div className="space-y-4">
            <div className="flex justify-end">
                <button onClick={() => openModal('package')} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-blue-500/20">
                    <Plus size={14} /> Buat Paket
                </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {packages.length === 0 ? (
                    <div className="col-span-full bg-white rounded-2xl border border-slate-100 p-8 text-center text-slate-400">Belum ada paket SPMB.</div>
                ) : packages.map(pkg => (
                    <div key={pkg.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <h3 className="font-bold text-slate-800">{pkg.name}</h3>
                                <div className="flex gap-1.5 mt-1">
                                    {pkg.targetUnit && <Badge color="blue">{pkg.targetUnit}</Badge>}
                                    {pkg.gender && <Badge>{pkg.gender === 'L' ? 'Putra' : pkg.gender === 'P' ? 'Putri' : 'Unisex'}</Badge>}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-lg font-extrabold text-blue-600">Rp {(pkg.price || 0).toLocaleString('id-ID')}</div>
                                <div className="text-[10px] text-slate-400">{pkg.isFixedPrice ? 'Harga Fixed' : 'Harga Dinamis'}</div>
                            </div>
                        </div>
                        <div className="border-t border-slate-100 pt-3">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Isi Paket ({pkg.items?.length || 0} item)</p>
                            {pkg.items?.map(pi => (
                                <div key={pi.id} className="flex justify-between text-xs text-slate-600 py-0.5">
                                    <span>{pi.item?.name}</span>
                                    <span className="text-slate-400">x{pi.qty}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderVendors = () => (
        <div className="space-y-4">
            <div className="flex justify-end">
                <button onClick={() => openModal('vendor')} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-blue-500/20">
                    <Plus size={14} /> Tambah Vendor
                </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {vendors.length === 0 ? (
                    <div className="col-span-full bg-white rounded-2xl border border-slate-100 p-8 text-center text-slate-400">Belum ada data vendor.</div>
                ) : vendors.map(v => (
                    <div key={v.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                        <h3 className="font-bold text-slate-800 mb-1">{v.name}</h3>
                        <p className="text-xs text-slate-500 mb-3">{v.phone || '-'} • {v.contactPerson || '-'}</p>
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="bg-slate-50 rounded-lg p-2">
                                <div className="text-lg font-extrabold text-slate-700">{v.rating?.toFixed(1) || '0.0'}</div>
                                <div className="text-[10px] text-slate-400">Rating</div>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-2">
                                <div className="text-lg font-extrabold text-green-600">{v.onTimeRate?.toFixed(0) || 0}%</div>
                                <div className="text-[10px] text-slate-400">Tepat Waktu</div>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-2">
                                <div className="text-lg font-extrabold text-red-500">{v.rejectRate?.toFixed(0) || 0}%</div>
                                <div className="text-[10px] text-slate-400">Reject</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderSales = () => (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input type="text" placeholder="Cari kode, nama pelanggan, atau siswa..." className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-100" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <button onClick={() => openModal('sale')} className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-green-500/20">
                    <ShoppingCart size={14} /> Buat Penjualan
                </button>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                        <tr>
                            <th className="p-3 text-left">Invoice</th>
                            <th className="p-3 text-left">Pelanggan</th>
                            <th className="p-3 text-center">Tipe</th>
                            <th className="p-3 text-right">Total</th>
                            <th className="p-3 text-center">Bayar</th>
                            <th className="p-3 text-center">Status</th>
                            <th className="p-3 text-center">Tanggal</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan="7" className="p-8 text-center text-slate-400">Memuat data...</td></tr>
                        ) : sales.length === 0 ? (
                            <tr><td colSpan="7" className="p-8 text-center text-slate-400">Belum ada transaksi penjualan.</td></tr>
                        ) : sales.map(s => (
                            <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="p-3 font-mono text-xs text-slate-400">{s.code}</td>
                                <td className="p-3">
                                    <div className="font-bold text-slate-800">{s.customerName}</div>
                                    {s.studentName && <div className="text-[10px] text-slate-400">Siswa: {s.studentName}</div>}
                                </td>
                                <td className="p-3 text-center"><Badge color={s.type === 'SPMB' ? 'purple' : s.type === 'UNIT_ORDER' ? 'blue' : 'slate'}>{s.type}</Badge></td>
                                <td className="p-3 text-right font-bold text-slate-700">Rp {(s.totalAmount || 0).toLocaleString('id-ID')}</td>
                                <td className="p-3 text-center">
                                    <Badge color={s.paymentStatus === 'PAID' ? 'green' : s.paymentStatus === 'PARTIAL' ? 'orange' : 'red'}>{s.paymentStatus}</Badge>
                                </td>
                                <td className="p-3 text-center">
                                    <Badge color={s.status === 'COMPLETED' ? 'green' : s.status === 'PARTIAL_DELIVERED' ? 'orange' : 'slate'}>{s.status}</Badge>
                                </td>
                                <td className="p-3 text-center text-xs text-slate-500">{new Date(s.createdAt).toLocaleDateString('id-ID')}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderTransactions = () => (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2 items-center">
                <select className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white outline-none" value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)}>
                    <option value="">Semua Gudang</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                <button onClick={() => openModal('transaction')} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-blue-500/20 ml-auto">
                    <Plus size={14} /> Transaksi Baru
                </button>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                        <tr>
                            <th className="p-3 text-left">Kode</th>
                            <th className="p-3 text-center">Tipe</th>
                            <th className="p-3 text-left">Barang</th>
                            <th className="p-3 text-center">Gudang</th>
                            <th className="p-3 text-center">Qty</th>
                            <th className="p-3 text-right">Biaya</th>
                            <th className="p-3 text-center">Tanggal</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan="7" className="p-8 text-center text-slate-400">Memuat data...</td></tr>
                        ) : transactions.length === 0 ? (
                            <tr><td colSpan="7" className="p-8 text-center text-slate-400">Belum ada transaksi stok.</td></tr>
                        ) : transactions.map(t => (
                            <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="p-3 font-mono text-xs text-slate-400">{t.code}</td>
                                <td className="p-3 text-center">
                                    <Badge color={t.type === 'IN' ? 'green' : t.type === 'OUT' ? 'red' : t.type === 'MUTATION' ? 'blue' : 'orange'}>{t.type}</Badge>
                                </td>
                                <td className="p-3 font-medium text-slate-700">{t.variant?.item?.name} ({t.variant?.size || '-'})</td>
                                <td className="p-3 text-center text-xs text-slate-500">
                                    {t.warehouse?.name}
                                    {t.toWarehouse && <span className="text-blue-500"> → {t.toWarehouse.name}</span>}
                                </td>
                                <td className="p-3 text-center font-bold">{t.quantity > 0 ? `+${t.quantity}` : t.quantity}</td>
                                <td className="p-3 text-right text-slate-600">Rp {Math.abs(t.totalCost || 0).toLocaleString('id-ID')}</td>
                                <td className="p-3 text-center text-xs text-slate-500">{new Date(t.createdAt).toLocaleDateString('id-ID')}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderExchanges = () => (
        <div className="space-y-4">
            <div className="flex justify-end">
                <button onClick={() => openModal('exchange')} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-blue-500/20">
                    <RefreshCw size={14} /> Tukar Ukuran
                </button>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                        <tr>
                            <th className="p-3 text-left">Kode</th>
                            <th className="p-3 text-left">Pelanggan</th>
                            <th className="p-3 text-left">Dari</th>
                            <th className="p-3 text-center">→</th>
                            <th className="p-3 text-left">Ke</th>
                            <th className="p-3 text-center">Qty</th>
                            <th className="p-3 text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {exchanges.length === 0 ? (
                            <tr><td colSpan="7" className="p-8 text-center text-slate-400">Belum ada data tukar ukuran.</td></tr>
                        ) : exchanges.map(e => (
                            <tr key={e.id} className="hover:bg-slate-50/80">
                                <td className="p-3 font-mono text-xs text-slate-400">{e.code}</td>
                                <td className="p-3 font-bold text-slate-800">{e.customerName}</td>
                                <td className="p-3 text-sm">{e.fromVariant?.item?.name} <Badge>{e.fromVariant?.size}</Badge></td>
                                <td className="p-3 text-center text-slate-400">→</td>
                                <td className="p-3 text-sm">{e.toVariant?.item?.name} <Badge color="blue">{e.toVariant?.size}</Badge></td>
                                <td className="p-3 text-center font-bold">{e.qty}</td>
                                <td className="p-3 text-center"><Badge color={e.status === 'COMPLETED' ? 'green' : e.status === 'REJECTED' ? 'red' : 'orange'}>{e.status}</Badge></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const tabContent = {
        dashboard: renderDashboard,
        items: renderItems,
        stock: renderStock,
        packages: renderPackages,
        vendors: renderVendors,
        sales: renderSales,
        transactions: renderTransactions,
        exchanges: renderExchanges,
    };

    // ========== MODALS ==========

    const renderModalContent = () => {
        const { type, data } = modal;

        if (type === 'warehouse') {
            return <SimpleForm fields={[{ name: 'name', label: 'Nama Gudang', required: true }, { name: 'address', label: 'Alamat' }, { name: 'picName', label: 'PIC' }, { name: 'picPhone', label: 'No. HP PIC' }]} initialData={data} onSave={handleSaveWarehouse} />;
        }
        if (type === 'category') {
            return <SimpleForm fields={[{ name: 'name', label: 'Nama Kategori', required: true, placeholder: 'Contoh: Nasional, Batik, Muslim' }]} initialData={data} onSave={handleSaveCategory} />;
        }
        if (type === 'item') {
            return <ItemForm categories={categories} initialData={data} onSave={handleSaveItem} />;
        }
        if (type === 'vendor') {
            return <SimpleForm fields={[{ name: 'name', label: 'Nama Vendor/Konveksi', required: true }, { name: 'phone', label: 'No. Telepon' }, { name: 'contactPerson', label: 'Contact Person' }, { name: 'address', label: 'Alamat' }, { name: 'email', label: 'Email' }, { name: 'description', label: 'Keterangan' }]} initialData={data} onSave={handleSaveVendor} />;
        }
        if (type === 'transaction') {
            return <TransactionForm warehouses={warehouses} vendors={vendors} onSave={handleSaveTransaction} />;
        }
        if (type === 'package') {
            return <PackageForm items={items.length ? items : []} onSave={handleSavePackage} initialData={data} />;
        }
        return null;
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="px-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-600">Manajemen Seragam</h1>
                <p className="text-slate-500 text-sm mt-1">Kelola stok, distribusi, vendor, dan penjualan seragam.</p>
            </div>

            {/* Tab Navigation */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mx-2 overflow-hidden">
                <div className="flex overflow-x-auto border-b border-slate-100 px-2 scrollbar-hide">
                    {TABS.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => { setActiveTab(tab.key); setSearch(''); }}
                            className={`flex items-center gap-2 px-4 py-3.5 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${activeTab === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                        >
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>

                <div className="p-4 sm:p-5">
                    {tabContent[activeTab]?.()}
                </div>
            </div>

            {/* Modal */}
            <Modal isOpen={modal.open} onClose={closeModal} title={
                modal.type === 'warehouse' ? 'Kelola Gudang' :
                modal.type === 'category' ? 'Kelola Kategori' :
                modal.type === 'item' ? (modal.data ? 'Edit Barang' : 'Tambah Barang') :
                modal.type === 'vendor' ? (modal.data ? 'Edit Vendor' : 'Tambah Vendor') :
                modal.type === 'transaction' ? 'Transaksi Stok' :
                modal.type === 'package' ? (modal.data ? 'Edit Paket' : 'Buat Paket SPMB') :
                modal.type === 'sale' ? 'Buat Penjualan' :
                modal.type === 'exchange' ? 'Tukar Ukuran' : ''
            } wide={['item', 'transaction', 'package', 'sale'].includes(modal.type)}>
                {renderModalContent()}
            </Modal>
        </div>
    );
};

// ========== REUSABLE FORM COMPONENTS ==========

const SimpleForm = ({ fields, initialData, onSave }) => {
    const [form, setForm] = useState(initialData || {});
    return (
        <div className="space-y-4">
            {fields.map(f => (
                <InputField key={f.name} label={f.label} value={form[f.name] || ''} onChange={e => setForm({ ...form, [f.name]: e.target.value })} placeholder={f.placeholder} required={f.required} />
            ))}
            <button onClick={() => onSave(form)} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 transition-all">Simpan</button>
        </div>
    );
};

const ItemForm = ({ categories, initialData, onSave }) => {
    const [form, setForm] = useState(initialData || { sizes: ['S', 'M', 'L', 'XL', 'XXL'] });
    const [sizeInput, setSizeInput] = useState('');

    const addSize = () => {
        if (sizeInput && !form.sizes?.includes(sizeInput.toUpperCase())) {
            setForm({ ...form, sizes: [...(form.sizes || []), sizeInput.toUpperCase()] });
            setSizeInput('');
        }
    };
    const removeSize = (s) => setForm({ ...form, sizes: form.sizes.filter(x => x !== s) });

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <InputField label="Nama Barang" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Kemeja Putih PDH" required />
                <SelectField label="Kategori" value={form.categoryId || ''} onChange={e => setForm({ ...form, categoryId: e.target.value })}>
                    <option value="">Pilih Kategori</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </SelectField>
            </div>
            <div className="grid grid-cols-3 gap-4">
                <SelectField label="Tipe" value={form.type || ''} onChange={e => setForm({ ...form, type: e.target.value })}>
                    <option value="">Pilih Tipe</option>
                    <option value="BAJU">Baju</option>
                    <option value="CELANA">Celana</option>
                    <option value="JILBAB">Jilbab</option>
                    <option value="TOPI">Topi</option>
                    <option value="DASI">Dasi</option>
                    <option value="ATRIBUT">Atribut</option>
                </SelectField>
                <SelectField label="Gender" value={form.gender || ''} onChange={e => setForm({ ...form, gender: e.target.value })}>
                    <option value="">Semua</option>
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                    <option value="UNISEX">Unisex</option>
                </SelectField>
                <SelectField label="Jenjang" value={form.targetUnit || ''} onChange={e => setForm({ ...form, targetUnit: e.target.value })}>
                    <option value="">Semua</option>
                    <option value="TK">TK</option>
                    <option value="SD">SD</option>
                    <option value="SMP">SMP</option>
                    <option value="SMA">SMA</option>
                </SelectField>
            </div>
            <InputField label="Harga Jual (Rp)" type="number" value={form.sellPrice || ''} onChange={e => setForm({ ...form, sellPrice: e.target.value })} />
            <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Ukuran</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                    {(form.sizes || []).map(s => (
                        <span key={s} className="px-2 py-1 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg text-xs font-bold flex items-center gap-1">
                            {s} <button onClick={() => removeSize(s)} className="hover:text-red-500"><X size={12} /></button>
                        </span>
                    ))}
                </div>
                <div className="flex gap-2">
                    <input className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm" value={sizeInput} onChange={e => setSizeInput(e.target.value)} placeholder="Tambah ukuran" onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSize())} />
                    <button onClick={addSize} className="px-3 py-2 bg-slate-100 rounded-xl text-sm font-bold hover:bg-slate-200"><Plus size={14} /></button>
                </div>
            </div>
            <button onClick={() => onSave(form)} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 transition-all">Simpan</button>
        </div>
    );
};

const TransactionForm = ({ warehouses, vendors, onSave }) => {
    const [form, setForm] = useState({ type: 'IN', quantity: 1, costPerUnit: 0 });
    const [allVariants, setAllVariants] = useState([]);

    useEffect(() => {
        api.get('/uniforms/items').then(r => {
            const variants = [];
            r.data.forEach(item => {
                item.variants?.forEach(v => {
                    variants.push({ ...v, itemName: item.name });
                });
            });
            setAllVariants(variants);
        });
    }, []);

    return (
        <div className="space-y-4">
            <SelectField label="Tipe Transaksi" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                <option value="IN">Barang Masuk (IN)</option>
                <option value="OUT">Barang Keluar (OUT)</option>
                <option value="MUTATION">Mutasi Antar Gudang</option>
                <option value="ADJUSTMENT">Penyesuaian Stok</option>
            </SelectField>
            <SelectField label="Barang (Variant)" value={form.variantId || ''} onChange={e => setForm({ ...form, variantId: e.target.value })}>
                <option value="">Pilih Barang</option>
                {allVariants.map(v => <option key={v.id} value={v.id}>{v.itemName} - {v.size} ({v.sku})</option>)}
            </SelectField>
            <div className="grid grid-cols-2 gap-4">
                <SelectField label="Gudang Asal" value={form.warehouseId || ''} onChange={e => setForm({ ...form, warehouseId: e.target.value })}>
                    <option value="">Pilih Gudang</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </SelectField>
                {form.type === 'MUTATION' && (
                    <SelectField label="Gudang Tujuan" value={form.toWarehouseId || ''} onChange={e => setForm({ ...form, toWarehouseId: e.target.value })}>
                        <option value="">Pilih Gudang Tujuan</option>
                        {warehouses.filter(w => String(w.id) !== String(form.warehouseId)).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </SelectField>
                )}
            </div>
            <div className="grid grid-cols-2 gap-4">
                <InputField label="Jumlah" type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
                {form.type === 'IN' && (
                    <InputField label="Harga Beli per Unit (Rp)" type="number" value={form.costPerUnit} onChange={e => setForm({ ...form, costPerUnit: e.target.value })} />
                )}
            </div>
            {form.type === 'IN' && (
                <SelectField label="Vendor (Opsional)" value={form.vendorId || ''} onChange={e => setForm({ ...form, vendorId: e.target.value })}>
                    <option value="">Tanpa Vendor</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </SelectField>
            )}
            {form.type === 'ADJUSTMENT' && (
                <InputField label="Alasan Penyesuaian *" value={form.reason || ''} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Contoh: Cacat dari vendor, Dimakan tikus, Hilang" required />
            )}
            <InputField label="Catatan" value={form.note || ''} onChange={e => setForm({ ...form, note: e.target.value })} />
            <button onClick={() => onSave(form)} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20">Simpan Transaksi</button>
        </div>
    );
};

const PackageForm = ({ items, initialData, onSave }) => {
    const [form, setForm] = useState(initialData || { isFixedPrice: true, items: [] });
    const [selectedItem, setSelectedItem] = useState('');

    const addItem = () => {
        if (!selectedItem) return;
        const item = items.find(i => String(i.id) === String(selectedItem));
        if (!item || form.items?.some(fi => fi.itemId === item.id)) return;
        setForm({ ...form, items: [...(form.items || []), { itemId: item.id, itemName: item.name, qty: 1 }] });
        setSelectedItem('');
    };

    return (
        <div className="space-y-4">
            <InputField label="Nama Paket" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Paket Siswa Baru SMP Putra" required />
            <div className="grid grid-cols-3 gap-4">
                <SelectField label="Jenjang" value={form.targetUnit || ''} onChange={e => setForm({ ...form, targetUnit: e.target.value })}>
                    <option value="">Semua</option>
                    <option value="TK">TK</option><option value="SD">SD</option><option value="SMP">SMP</option><option value="SMA">SMA</option>
                </SelectField>
                <SelectField label="Gender" value={form.gender || ''} onChange={e => setForm({ ...form, gender: e.target.value })}>
                    <option value="">Semua</option>
                    <option value="L">Putra</option><option value="P">Putri</option>
                </SelectField>
                <InputField label="Harga Paket (Rp)" type="number" value={form.price || ''} onChange={e => setForm({ ...form, price: e.target.value })} />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Isi Paket</label>
                {(form.items || []).map((fi, idx) => (
                    <div key={idx} className="flex items-center gap-2 mb-1.5 bg-slate-50 p-2 rounded-lg">
                        <span className="flex-1 text-sm font-medium">{fi.itemName || items.find(i => i.id === fi.itemId)?.name}</span>
                        <input type="number" min="1" className="w-16 border rounded-lg px-2 py-1 text-sm text-center" value={fi.qty} onChange={e => { const newItems = [...form.items]; newItems[idx].qty = parseInt(e.target.value) || 1; setForm({ ...form, items: newItems }); }} />
                        <button onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })} className="text-red-400 hover:text-red-600"><X size={14} /></button>
                    </div>
                ))}
                <div className="flex gap-2 mt-2">
                    <select className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white" value={selectedItem} onChange={e => setSelectedItem(e.target.value)}>
                        <option value="">Pilih Barang</option>
                        {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                    <button onClick={addItem} className="px-3 py-2 bg-slate-100 rounded-xl hover:bg-slate-200"><Plus size={14} /></button>
                </div>
            </div>
            <button onClick={() => onSave(form)} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20">Simpan Paket</button>
        </div>
    );
};

export default UniformManagement;
