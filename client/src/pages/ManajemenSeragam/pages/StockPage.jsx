import { useState, useEffect, useCallback } from 'react';
import { Boxes, ArrowLeftRight } from 'lucide-react';
import api from '../../../lib/axios';
import { Modal } from '../UIComponents';
import { TransactionForm, ManualStockForm } from '../Forms';
import { StockTab } from '../StockTab';
import { TransactionsTab } from '../TransactionsTab';

const TABS = [
    { key: 'stock', label: 'Stok Gudang', icon: <Boxes size={16} /> },
    { key: 'transactions', label: 'Transaksi Stok', icon: <ArrowLeftRight size={16} /> },
];

export default function StockPage() {
    const [activeTab, setActiveTab] = useState('stock');
    
    // Data states
    const [stocks, setStocks] = useState([]);
    const [transactions, setTransactions] = useState([]);
    
    // Lookup states for forms
    const [warehouses, setWarehouses] = useState([]);
    const [categories, setCategories] = useState([]);
    const [clothingTypes, setClothingTypes] = useState([]);
    const [sizes, setSizes] = useState([]);
    const [units, setUnits] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [variants, setVariants] = useState([]);
    
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedWarehouse, setSelectedWarehouse] = useState('');
    const [modal, setModal] = useState({ open: false, type: '', data: null });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // Only fetch what is needed for the active tab, plus common dropdown data
            const commonRes = await Promise.all([
                api.get('/uniforms/warehouses'),
                api.get('/uniforms/categories'),
                api.get('/uniforms/clothing-types'),
                api.get('/uniforms/sizes'),
                api.get('/uniforms/units'),
                api.get('/uniforms/vendors'),
                api.get('/uniforms/variants')
            ]);
            
            setWarehouses(commonRes[0].data);
            setCategories(commonRes[1].data);
            setClothingTypes(commonRes[2].data);
            setSizes(commonRes[3].data);
            setUnits(commonRes[4].data);
            setVendors(commonRes[5].data);
            setVariants(commonRes[6].data);

            if (activeTab === 'stock') {
                const r = await api.get('/uniforms/stocks', { params: { warehouseId: selectedWarehouse || undefined, search } });
                setStocks(r.data);
            } else if (activeTab === 'transactions') {
                const r = await api.get('/uniforms/transactions', { params: { warehouseId: selectedWarehouse || undefined } });
                setTransactions(r.data);
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

    const handleSaveTransaction = async (formData) => {
        try {
            await api.post('/uniforms/transactions', formData);
            closeModal();
            fetchData();
        } catch (err) {
            alert(err.response?.data?.error || 'Gagal menyimpan transaksi');
        }
    };

    const handleSaveManualStock = async (formData) => {
        try {
            await api.post('/uniforms/stocks/manual', formData);
            alert('Stok berhasil ditambahkan!');
            closeModal();
            fetchData();
        } catch (err) {
            alert(err.response?.data?.error || 'Gagal menambahkan stok');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                    <Boxes size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Stok & Inventori</h1>
                    <p className="text-slate-500">Kelola stok seragam dan riwayat transaksi</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
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
                    {activeTab === 'stock' && (
                        <StockTab stocks={stocks} loading={loading} search={search} setSearch={setSearch} selectedWarehouse={selectedWarehouse} setSelectedWarehouse={setSelectedWarehouse} warehouses={warehouses} openModal={openModal} fetchStocks={fetchData} />
                    )}
                    {activeTab === 'transactions' && (
                        <TransactionsTab transactions={transactions} loading={loading} selectedWarehouse={selectedWarehouse} setSelectedWarehouse={setSelectedWarehouse} warehouses={warehouses} openModal={openModal} />
                    )}
                </div>
            </div>

            <Modal isOpen={modal.open} onClose={closeModal} title={
                modal.type === 'transaction' ? 'Transaksi Stok' :
                modal.type === 'manual-stock' ? 'Tambah Stok Manual' : ''
            } wide={true}>
                {modal.type === 'transaction' && (
                    <TransactionForm warehouses={warehouses} vendors={vendors} variants={variants} onSave={handleSaveTransaction} />
                )}
                {modal.type === 'manual-stock' && (
                    <ManualStockForm categories={categories} clothingTypes={clothingTypes} sizes={sizes} vendors={vendors} units={units} warehouses={warehouses} onSave={handleSaveManualStock} />
                )}
            </Modal>
        </div>
    );
}
