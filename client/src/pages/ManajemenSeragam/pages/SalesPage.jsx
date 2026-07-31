import { useState, useEffect, useCallback } from 'react';
import { ShoppingCart, Package, RefreshCw } from 'lucide-react';
import api from '../../../lib/axios';
import { Modal } from '../UIComponents';
import { PackageForm } from '../Forms';
import { SaleForm } from '../SaleForm';
import { SalesTab } from '../SalesTab';
import { PackagesTab } from '../PackagesTab';
import { ExchangesTab } from '../ExchangesTab';

const TABS = [
    { key: 'sales', label: 'Pesanan', icon: <ShoppingCart size={16} /> },
    { key: 'packages', label: 'Paket SPMB', icon: <Package size={16} /> },
    { key: 'exchanges', label: 'Tukar Ukuran', icon: <RefreshCw size={16} /> },
];

export default function SalesPage() {
    const [activeTab, setActiveTab] = useState('sales');
    
    // Data states
    const [sales, setSales] = useState([]);
    const [packages, setPackages] = useState([]);
    const [exchanges, setExchanges] = useState([]);
    
    // Lookup states for forms
    const [units, setUnits] = useState([]);
    const [items, setItems] = useState([]);
    const [variants, setVariants] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    // also keep all packages globally for SaleForm
    const [allPackages, setAllPackages] = useState([]);
    
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [modal, setModal] = useState({ open: false, type: '', data: null });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch dropdown data needed for forms
            const commonRes = await Promise.all([
                api.get('/uniforms/units'),
                api.get('/uniforms/items'),
                api.get('/uniforms/variants'),
                api.get('/uniforms/warehouses'),
                api.get('/uniforms/packages')
            ]);
            setUnits(commonRes[0].data);
            setItems(commonRes[1].data);
            setVariants(commonRes[2].data);
            setWarehouses(commonRes[3].data);
            setAllPackages(commonRes[4].data);

            if (activeTab === 'sales') {
                const r = await api.get('/uniforms/sales', { params: { search } });
                setSales(r.data);
            } else if (activeTab === 'packages') {
                setPackages(commonRes[4].data);
            } else if (activeTab === 'exchanges') {
                const r = await api.get('/uniforms/exchanges');
                setExchanges(r.data);
            }
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [activeTab, search]);

    useEffect(() => {
        const t = setTimeout(fetchData, 300);
        return () => clearTimeout(t);
    }, [fetchData]);

    const openModal = (type, data = null) => setModal({ open: true, type, data });
    const closeModal = () => setModal({ open: false, type: '', data: null });

    const handleSavePackage = async (formData) => {
        try {
            if (formData.id) await api.put(`/uniforms/packages/${formData.id}`, formData);
            else await api.post('/uniforms/packages', formData);
            closeModal();
            fetchData();
        } catch (err) { alert(err.response?.data?.error || 'Gagal menyimpan'); }
    };

    const handleSaveSale = async (formData) => {
        try {
            const res = await api.post('/uniforms/sales', formData);
            closeModal();
            fetchData();
            if (formData.type === 'SPMB' && res.data?.id) {
                window.open(`/public/invoice-seragam/${res.data.id}`, '_blank');
            }
        } catch (err) { alert(err.response?.data?.error || 'Gagal menyimpan penjualan'); }
    };

    const handleFulfillSale = async (e) => {
        e.preventDefault();
        const warehouseId = e.target.warehouseId.value;
        if (!warehouseId) return alert('Silakan pilih gudang');
        try {
            await api.post(`/uniforms/sales/${modal.data.id}/fulfill`, { warehouseId });
            closeModal();
            fetchData();
        } catch (err) { alert(err.response?.data?.error || 'Gagal memproses pesanan'); }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                    <ShoppingCart size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Pesanan & Distribusi</h1>
                    <p className="text-slate-500">Kelola pesanan, paket SPMB, dan retur/tukar ukuran</p>
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
                    {activeTab === 'sales' && (
                        <SalesTab sales={sales} loading={loading} search={search} setSearch={setSearch} openModal={openModal} />
                    )}
                    {activeTab === 'packages' && (
                        <PackagesTab packages={packages} openModal={openModal} />
                    )}
                    {activeTab === 'exchanges' && (
                        <ExchangesTab exchanges={exchanges} openModal={openModal} />
                    )}
                </div>
            </div>

            <Modal isOpen={modal.open} onClose={closeModal} title={
                modal.type === 'package' ? (modal.data ? 'Edit Paket' : 'Buat Paket SPMB') :
                modal.type === 'sale' ? 'Buat Pesanan' :
                modal.type === 'exchange' ? 'Tukar Ukuran' :
                modal.type === 'fulfill' ? 'Proses & Keluarkan Barang' : ''
            } wide={modal.type === 'package'}>
                {modal.type === 'package' && (
                    <PackageForm items={items} units={units} onSave={handleSavePackage} initialData={modal.data} />
                )}
                {modal.type === 'sale' && (
                    <SaleForm 
                        warehouses={warehouses} packages={allPackages} variants={variants} units={units}
                        onSave={handleSaveSale} initialData={modal.data} 
                    />
                )}
                {modal.type === 'fulfill' && (
                    <form onSubmit={handleFulfillSale} className="space-y-4">
                        <p className="text-sm text-slate-600 mb-4">
                            Silakan pilih gudang yang akan digunakan untuk mengeluarkan barang bagi pesanan <strong>{modal.data?.code}</strong> ({modal.data?.customerName}).
                        </p>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Gudang Pengeluaran</label>
                            <select name="warehouseId" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500" required>
                                <option value="">-- Pilih Gudang --</option>
                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                        </div>
                        <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition">
                            Proses & Keluarkan Stok
                        </button>
                    </form>
                )}
            </Modal>
        </div>
    );
}
