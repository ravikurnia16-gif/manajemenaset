import { Search, Plus, Download, Upload, MoreVertical, ChevronDown, ChevronUp, PackageOpen } from 'lucide-react';
import { Badge } from './UIComponents';
import { useRef, useState } from 'react';
import api from '../../lib/axios';

export const StockTab = ({ stocks, loading, search, setSearch, selectedWarehouse, setSelectedWarehouse, warehouses, openModal, fetchStocks }) => {
    const fileInputRef = useRef(null);
    const [expandedRows, setExpandedRows] = useState({});

    const toggleRow = (itemId) => {
        setExpandedRows(prev => ({
            ...prev,
            [itemId]: !prev[itemId]
        }));
    };

    const handleImportTemplate = async () => {
        try {
            const res = await api.get('/uniforms/stocks/template', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'Template_Import_Stok_Seragam.xlsx');
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (err) {
            alert('Gagal mendownload template stok');
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await api.post('/uniforms/stocks/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert(res.data.message || 'Import berhasil!');
            if (fetchStocks) fetchStocks();
        } catch (error) {
            alert(error.response?.data?.error || 'Gagal mengimpor data');
        }
        e.target.value = null;
    };

    return (
    <div className="space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input type="text" placeholder="Cari nama barang..." className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-100" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white outline-none" value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)}>
                <option value="">Semua Gudang</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            
            <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
            
            <button onClick={handleImportTemplate} className="bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-slate-50 transition-colors" title="Download Template Stok">
                <Download size={14} /> Template Stok
            </button>
            <button onClick={() => openModal('manual-stock')} className="bg-blue-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20" title="Tambah Stok Manual">
                <Plus size={14} /> Tambah Stok
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/20" title="Import Stok">
                <Upload size={14} /> Import Stok
            </button>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {(() => {
                const groupedByItem = Object.values((stocks || []).reduce((acc, stock) => {
                    const item = stock.variant?.item;
                    if (!item) return acc;
                    if (!acc[item.id]) {
                        acc[item.id] = {
                            item: item,
                            totalQuantity: 0,
                            variants: {}
                        };
                    }
                    
                    const sku = stock.variant?.sku;
                    if (!acc[item.id].variants[sku]) {
                        acc[item.id].variants[sku] = {
                            variant: stock.variant,
                            totalQuantity: 0,
                            warehouses: {}
                        };
                    }
                    
                    acc[item.id].totalQuantity += stock.quantity;
                    acc[item.id].variants[sku].totalQuantity += stock.quantity;
                    
                    const whName = stock.warehouse?.name || 'Gudang';
                    if (!acc[item.id].variants[sku].warehouses[whName]) {
                        acc[item.id].variants[sku].warehouses[whName] = 0;
                    }
                    acc[item.id].variants[sku].warehouses[whName] += stock.quantity;

                    return acc;
                }, {}));

                return (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase text-xs">
                                <tr>
                                    <th className="px-6 py-4 font-bold w-12 text-center"></th>
                                    <th className="px-6 py-4 font-bold">Barang / Kategori</th>
                                    <th className="px-6 py-4 font-bold text-center">Total Stok</th>
                                    <th className="px-6 py-4 font-bold text-center">Status Global</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loading ? (
                                    <tr><td colSpan="4" className="text-center py-8 text-slate-400">Loading...</td></tr>
                                ) : groupedByItem.length === 0 ? (
                                    <tr><td colSpan="4" className="text-center py-8 text-slate-400">Belum ada data stok.</td></tr>
                                ) : groupedByItem.map(group => {
                                    const isExpanded = expandedRows[group.item.id];
                                    const minStock = group.item.minStock || 5;
                                    const status = group.totalQuantity <= 0 ? 'Habis' : group.totalQuantity <= (minStock * Object.keys(group.variants).length) ? 'Menipis' : 'Aman';
                                    
                                    return (
                                        <Fragment key={group.item.id}>
                                            <tr className="hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => toggleRow(group.item.id)}>
                                                <td className="px-6 py-4 text-center">
                                                    <button className="text-slate-400 hover:text-blue-600 transition-colors p-1.5 rounded-lg hover:bg-blue-50">
                                                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                                    </button>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-slate-800 text-base">{group.item.name}</div>
                                                    <div className="text-xs text-slate-500 mt-1 flex gap-2">
                                                        <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">{group.item.code}</span>
                                                        <span className="text-slate-400">• {Object.keys(group.variants).length} Ukuran</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="text-lg font-black text-slate-700">{group.totalQuantity}</span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <Badge color={status === 'Habis' ? 'red' : status === 'Menipis' ? 'orange' : 'green'}>{status}</Badge>
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr className="bg-slate-50/50">
                                                    <td colSpan="4" className="p-0 border-b border-slate-100">
                                                        <div className="px-10 py-4 border-l-4 border-blue-500 bg-blue-50/30">
                                                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2 mb-3">
                                                                <PackageOpen size={14} /> Rincian Stok per Ukuran
                                                            </h4>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                                                {Object.values(group.variants).map(vGroup => (
                                                                    <div key={vGroup.variant.sku} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 transition-colors">
                                                                        <div className="flex justify-between items-start mb-2">
                                                                            <span className="font-bold text-slate-800 flex items-center justify-center bg-slate-100 w-8 h-8 rounded-lg">{vGroup.variant.sizeName}</span>
                                                                            <span className={`text-xl font-black ${vGroup.totalQuantity <= minStock ? 'text-red-500' : 'text-slate-700'}`}>{vGroup.totalQuantity}</span>
                                                                        </div>
                                                                        <div className="text-[10px] text-slate-400 font-mono mb-3">{vGroup.variant.sku}</div>
                                                                        <div className="space-y-1.5 pt-3 border-t border-slate-100">
                                                                            {Object.entries(vGroup.warehouses).map(([whName, qty]) => (
                                                                                <div key={whName} className="flex justify-between text-xs items-center">
                                                                                    <span className="text-slate-500 truncate pr-2">{whName}</span>
                                                                                    <span className="font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">{qty}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                );
            })()}
        </div>
    </div>
    );
};
