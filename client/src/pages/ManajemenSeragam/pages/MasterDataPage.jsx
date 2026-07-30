import { useState, useEffect, useCallback } from 'react';
import { Database, LayoutGrid, Shirt, DollarSign } from 'lucide-react';
import api from '../../../lib/axios';
import { Modal } from '../UIComponents';
import { SimpleForm } from '../Forms';
import { MasterDataTab } from '../tabs/MasterDataTab';
import { ItemsTab } from '../ItemsTab';
import { PricingRulesTab } from '../PricingRulesTab';

const TABS = [
    { key: 'master', label: 'Master Kategori', icon: <LayoutGrid size={16} /> },
    { key: 'items', label: 'Data Barang', icon: <Shirt size={16} /> },
    { key: 'pricing', label: 'Aturan Harga', icon: <DollarSign size={16} /> },
];

export default function MasterDataPage() {
    const [activeTab, setActiveTab] = useState('master');
    const [categories, setCategories] = useState([]);
    const [clothingTypes, setClothingTypes] = useState([]);
    const [sizes, setSizes] = useState([]);
    const [units, setUnits] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [variants, setVariants] = useState([]);
    
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [modal, setModal] = useState({ open: false, type: '', data: null });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [catRes, ctRes, szRes, unRes, whRes, vnRes, varRes] = await Promise.all([
                api.get('/uniforms/categories'),
                api.get('/uniforms/clothing-types'),
                api.get('/uniforms/sizes'),
                api.get('/uniforms/units'),
                api.get('/uniforms/warehouses'),
                api.get('/uniforms/vendors'),
                api.get('/uniforms/variants')
            ]);
            setCategories(catRes.data);
            setClothingTypes(ctRes.data);
            setSizes(szRes.data);
            setUnits(unRes.data);
            setWarehouses(whRes.data);
            setVendors(vnRes.data);
            setVariants(varRes.data);
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const openModal = (type, data = null) => setModal({ open: true, type, data });
    const closeModal = () => setModal({ open: false, type: '', data: null });

    const handleSaveWarehouse = async (formData) => {
        try {
            if (formData.id) await api.put(`/uniforms/warehouses/${formData.id}`, formData);
            else await api.post('/uniforms/warehouses', formData);
            closeModal();
            fetchData();
        } catch (err) {
            alert(err.response?.data?.error || 'Gagal menyimpan');
        }
    };

    const handleSaveItem = async (formData) => {
        try {
            if (formData.id) await api.put(`/uniforms/items/${formData.id}`, formData);
            else await api.post('/uniforms/items', formData);
            closeModal();
            fetchData();
        } catch (err) {
            alert(err.response?.data?.error || 'Gagal menyimpan');
        }
    };

    const handleImportItem = async (file) => {
        try {
            setLoading(true);
            const formData = new FormData();
            formData.append('file', file);
            const res = await api.post('/uniforms/items/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert(res.data.message || 'Import berhasil');
            closeModal();
            fetchData();
        } catch (err) {
            alert(err.response?.data?.error || 'Gagal mengimport data');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                    <Database size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Data Induk Seragam</h1>
                    <p className="text-slate-500">Kelola master data kategori, barang, dan aturan harga</p>
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
                    {activeTab === 'master' && (
                        <MasterDataTab categories={categories} clothingTypes={clothingTypes} sizes={sizes} units={units} warehouses={warehouses} fetchData={fetchData} />
                    )}
                    {activeTab === 'items' && (
                        <ItemsTab variants={variants.filter(v => v.sku.toLowerCase().includes(search.toLowerCase()) || v.item?.name?.toLowerCase().includes(search.toLowerCase()))} loading={loading} search={search} setSearch={setSearch} />
                    )}
                    {activeTab === 'pricing' && (
                        <PricingRulesTab categories={categories} clothingTypes={clothingTypes} units={units} sizes={sizes} />
                    )}
                </div>
            </div>

            <Modal isOpen={modal.open} onClose={closeModal} title={
                modal.type === 'warehouse' ? 'Kelola Gudang' : ''
            }>
                {modal.type === 'warehouse' && (
                    <SimpleForm fields={[{ name: 'name', label: 'Nama Gudang', required: true }, { name: 'location', label: 'Lokasi Gudang' }]} initialData={modal.data} onSave={handleSaveWarehouse} />
                )}
            </Modal>
        </div>
    );
}
