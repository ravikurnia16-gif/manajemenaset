import { useState, useEffect, useCallback } from 'react';
import { Shirt, Package, Users, ArrowLeftRight, ShoppingCart, BarChart3, Boxes, RefreshCw, Database } from 'lucide-react';
import api from '../../lib/axios';

import { Modal } from './UIComponents';
import { SimpleForm, ItemForm, TransactionForm, PackageForm } from './Forms';

import { DashboardTab } from './DashboardTab';
import { ItemsTab } from './ItemsTab';
import { StockTab } from './StockTab';
import { PackagesTab } from './PackagesTab';
import { VendorsTab } from './VendorsTab';
import { SalesTab } from './SalesTab';
import { TransactionsTab } from './TransactionsTab';
import { ExchangesTab } from './ExchangesTab';
import { MasterDataTab } from './tabs/MasterDataTab';

const TABS = [
    { key: 'dashboard', label: 'Dashboard', icon: <BarChart3 size={16} /> },
    { key: 'master', label: 'Master Data', icon: <Database size={16} /> },
    { key: 'items', label: 'Data Barang', icon: <Shirt size={16} /> },
    { key: 'stock', label: 'Stok Gudang', icon: <Boxes size={16} /> },
    { key: 'packages', label: 'Paket SPMB', icon: <Package size={16} /> },
    { key: 'sales', label: 'Penjualan', icon: <ShoppingCart size={16} /> },
    { key: 'vendors', label: 'Vendor', icon: <Users size={16} /> },
    { key: 'transactions', label: 'Transaksi Stok', icon: <ArrowLeftRight size={16} /> },
    { key: 'exchanges', label: 'Tukar Ukuran', icon: <RefreshCw size={16} /> },
];

const ManajemenSeragam = () => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [stats, setStats] = useState({});
    const [warehouses, setWarehouses] = useState([]);
    const [categories, setCategories] = useState([]);
    const [clothingTypes, setClothingTypes] = useState([]);
    const [sizes, setSizes] = useState([]);
    const [units, setUnits] = useState([]);
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
            // Always fetch master data (needed for dropdowns)
            const [whRes, catRes, ctRes, szRes, vnRes, unRes] = await Promise.all([
                api.get('/uniforms/warehouses'),
                api.get('/uniforms/categories'),
                api.get('/uniforms/clothing-types'),
                api.get('/uniforms/sizes'),
                api.get('/uniforms/vendors'),
                api.get('/uniforms/units')
            ]);
            setWarehouses(whRes.data);
            setCategories(catRes.data);
            setClothingTypes(ctRes.data);
            setSizes(szRes.data);
            setVendors(vnRes.data);
            setUnits(unRes.data);

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

    const renderModalContent = () => {
        const { type, data } = modal;

        if (type === 'warehouse') {
            return <SimpleForm fields={[{ name: 'name', label: 'Nama Gudang', required: true }, { name: 'location', label: 'Lokasi Gudang' }]} initialData={data} onSave={handleSaveWarehouse} />;
        }
        if (type === 'item') {
            return <ItemForm categories={categories} clothingTypes={clothingTypes} sizes={sizes} vendors={vendors} units={units} initialData={data} onSave={handleSaveItem} />;
        }
        if (type === 'vendor') {
            return <SimpleForm fields={[{ name: 'name', label: 'Nama Vendor/Konveksi', required: true }, { name: 'phone', label: 'No. Telepon' }, { name: 'contactPerson', label: 'Contact Person' }, { name: 'address', label: 'Alamat' }, { name: 'email', label: 'Email' }, { name: 'description', label: 'Keterangan' }]} initialData={data} onSave={handleSaveVendor} />;
        }
        if (type === 'transaction') {
            return <TransactionForm warehouses={warehouses} vendors={vendors} onSave={handleSaveTransaction} />;
        }
        if (type === 'package') {
            return <PackageForm items={items.length ? items : []} units={units} onSave={handleSavePackage} initialData={data} />;
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
                    {activeTab === 'dashboard' && <DashboardTab stats={stats} />}
                    {activeTab === 'master' && <MasterDataTab categories={categories} clothingTypes={clothingTypes} sizes={sizes} units={units} warehouses={warehouses} fetchData={fetchData} />}
                    {activeTab === 'items' && <ItemsTab items={items} loading={loading} search={search} setSearch={setSearch} openModal={openModal} />}
                    {activeTab === 'stock' && <StockTab stocks={stocks} loading={loading} search={search} setSearch={setSearch} selectedWarehouse={selectedWarehouse} setSelectedWarehouse={setSelectedWarehouse} warehouses={warehouses} openModal={openModal} />}
                    {activeTab === 'packages' && <PackagesTab packages={packages} openModal={openModal} />}
                    {activeTab === 'vendors' && <VendorsTab vendors={vendors} openModal={openModal} />}
                    {activeTab === 'sales' && <SalesTab sales={sales} loading={loading} search={search} setSearch={setSearch} openModal={openModal} />}
                    {activeTab === 'transactions' && <TransactionsTab transactions={transactions} loading={loading} selectedWarehouse={selectedWarehouse} setSelectedWarehouse={setSelectedWarehouse} warehouses={warehouses} openModal={openModal} />}
                    {activeTab === 'exchanges' && <ExchangesTab exchanges={exchanges} openModal={openModal} />}
                </div>
            </div>

            {/* Modal */}
            <Modal isOpen={modal.open} onClose={closeModal} title={
                modal.type === 'warehouse' ? 'Kelola Gudang' :
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

export default ManajemenSeragam;
