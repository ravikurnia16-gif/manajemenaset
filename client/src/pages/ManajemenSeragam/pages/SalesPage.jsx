import { useState, useEffect, useCallback } from 'react';
import { ShoppingCart, Package, RefreshCw } from 'lucide-react';
import api from '../../../lib/axios';
import { Modal } from '../UIComponents';
import { PackageForm } from '../Forms';
import { SaleForm } from '../SaleForm';
import { FulfillForm } from '../FulfillForm';
import { SalesTab } from '../SalesTab';
import { PackagesTab } from '../PackagesTab';
import { ExchangesTab } from '../ExchangesTab';
import { ExchangeForm } from '../ExchangeForm';

const TABS = [
    { key: 'sales_spmb', label: 'Pesanan SPMB', icon: <ShoppingCart size={16} /> },
    { key: 'sales_retail', label: 'Pesanan Warid', icon: <ShoppingCart size={16} /> },
    { key: 'packages', label: 'Paket SPMB', icon: <Package size={16} /> },
    { key: 'exchanges', label: 'Tukar Ukuran', icon: <RefreshCw size={16} /> },
];

export default function SalesPage() {
    const [activeTab, setActiveTab] = useState('sales_retail');
    
    // Data states
    const [sales, setSales] = useState([]);
    const [packages, setPackages] = useState([]);
    const [exchanges, setExchanges] = useState([]);

    const user = JSON.parse(localStorage.getItem('user')) || {};
    const canFulfill = ['SUPER_ADMIN', 'ADMIN_ASET'].includes(user.role);
    
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

            if (activeTab === 'sales_spmb' || activeTab === 'sales_retail') {
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

    const handleFulfillSale = async (saleIdOrFulfillments, optionalFulfillments) => {
        let saleId = typeof saleIdOrFulfillments === 'number' || typeof saleIdOrFulfillments === 'string' ? saleIdOrFulfillments : modal.data?.id;
        let fulfillments = optionalFulfillments || (Array.isArray(saleIdOrFulfillments) ? saleIdOrFulfillments : []);
        
        try {
            await api.post(`/uniforms/sales/${saleId}/fulfill`, { itemUpdates: fulfillments });
            if (modal.open) closeModal();
            fetchData();
        } catch (err) { 
            alert(err.response?.data?.error || 'Gagal memproses pesanan'); 
            throw err;
        }
    };

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

    const handleDeleteSale = async (id) => {
        if (!confirm('Yakin ingin membatalkan/menghapus pesanan ini?')) return;
        try {
            await api.delete(`/uniforms/sales/${id}`);
            fetchData();
        } catch (err) {
            alert(err.response?.data?.error || 'Gagal menghapus pesanan');
        }
    };

    const handleUpdatePayment = async (id, status) => {
        try {
            await api.put(`/uniforms/sales/${id}/payment`, { paymentStatus: status });
            fetchData();
        } catch (err) {
            alert(err.response?.data?.error || 'Gagal mengubah status pembayaran');
        }
    };

    const handleSaveExchange = async (formData) => {
        try {
            await api.post('/uniforms/exchanges', formData);
            closeModal();
            fetchData();
        } catch (err) { alert(err.response?.data?.error || 'Gagal memproses tukar ukuran'); }
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
                    {activeTab === 'sales_spmb' && (
                        <SalesTab 
                            sales={sales.filter(s => s.type === 'SPMB')} 
                            loading={loading} 
                            search={search} 
                            setSearch={setSearch} 
                            openModal={openModal} 
                            canFulfill={canFulfill}
                            warehouses={warehouses}
                            onFulfillSale={handleFulfillSale}
                            onDelete={handleDeleteSale}
                            onUpdatePayment={handleUpdatePayment}
                        />
                    )}
                    {activeTab === 'sales_retail' && (
                        <SalesTab 
                            sales={sales.filter(s => s.type !== 'SPMB')} 
                            loading={loading} 
                            search={search} 
                            setSearch={setSearch} 
                            openModal={openModal} 
                            canFulfill={canFulfill}
                            warehouses={warehouses}
                            onFulfillSale={handleFulfillSale}
                            onDelete={handleDeleteSale}
                            onUpdatePayment={handleUpdatePayment}
                        />
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
            } wide={modal.type === 'package' || modal.type === 'exchange'}>
                {modal.type === 'package' && (
                    <PackageForm items={items} units={units} onSave={handleSavePackage} initialData={modal.data} />
                )}
                {modal.type === 'sale' && (
                    <SaleForm 
                        warehouses={warehouses} packages={allPackages} variants={variants} units={units}
                        onSave={handleSaveSale} initialData={modal.data} 
                    />
                )}
                {modal.type === 'exchange' && (
                    <ExchangeForm 
                        warehouses={warehouses} variants={variants} 
                        onSave={handleSaveExchange} 
                    />
                )}
                {modal.type === 'fulfill' && (
                    <FulfillForm 
                        sale={modal.data} 
                        warehouses={warehouses} 
                        onSave={handleFulfillSale} 
                    />
                )}
            </Modal>
        </div>
    );
}
