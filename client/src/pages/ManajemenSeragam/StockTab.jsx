import { Search, Plus, Download, Upload, MoreVertical } from 'lucide-react';
import { Badge } from './UIComponents';
import { useRef, useState, useMemo, Fragment } from 'react';
import api from '../../lib/axios';

export const StockTab = ({ stocks, loading, search, setSearch, selectedWarehouse, setSelectedWarehouse, warehouses, openModal, fetchStocks }) => {
    const fileInputRef = useRef(null);
    const [expandedRow, setExpandedRow] = useState(null);

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
                <input type="text" placeholder="Cari nama barang atau SKU..." className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-100" value={search} onChange={e => setSearch(e.target.value)} />
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
                const groupedStocks = Object.values((stocks || []).reduce((acc, stock) => {
                    const sku = stock.variant?.sku;
                    if (!sku) return acc;
                    if (!acc[sku]) {
                        acc[sku] = {
                            id: stock.variant?.id,
                            sku: sku,
                            variant: stock.variant,
                            totalQuantity: 0,
                            minStock: stock.variant?.item?.minStock || stock.minStock || 3,
                            warehouses: []
                        };
                    }
                    acc[sku].totalQuantity += stock.quantity;
                    acc[sku].warehouses.push({
                        name: stock.warehouse?.name || 'Gudang',
                        quantity: stock.quantity
                    });
                    return acc;
                }, {}));

                return (
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                            <tr>
                                <th className="p-3 text-left">SKU</th>
                                <th className="p-3 text-left">Barang</th>
                                <th className="p-3 text-left">Total Stok</th>
                                <th className="p-3 text-center">Status</th>
                                <th className="p-3 text-center w-16">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan="5" className="p-8 text-center text-slate-400">Memuat data...</td></tr>
                            ) : groupedStocks.length === 0 ? (
                                <tr><td colSpan="5" className="p-8 text-center text-slate-400">Belum ada data stok.</td></tr>
                            ) : groupedStocks.map(group => (
                                <tr key={group.sku} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="p-3 font-mono text-xs text-slate-400">{group.sku}</td>
                                    <td className="p-3">
                                        <div className="font-bold text-slate-800">
                                            {group.variant?.item?.name} ({group.variant?.sizeName})
                                        </div>
                                    </td>
                                    <td className="p-3">
                                        <div className="flex flex-col gap-1 text-xs">
                                            {group.warehouses.map((w, idx) => (
                                                <div key={idx} className="flex justify-between items-center w-32 text-slate-500">
                                                    <span>{w.name}</span>
                                                    <span className="font-semibold text-slate-700">({w.quantity})</span>
                                                </div>
                                            ))}
                                            {group.warehouses.length > 1 && (
                                                <div className="flex justify-between items-center w-32 font-bold text-slate-800 border-t border-slate-100 pt-1 mt-1">
                                                    <span>Total</span>
                                                    <span className={`${group.totalQuantity <= group.minStock ? 'text-red-500' : 'text-slate-800'}`}>({group.totalQuantity})</span>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-3 text-center">
                                        {group.totalQuantity <= 0 ? <Badge color="red">Habis</Badge> : group.totalQuantity <= group.minStock ? <Badge color="orange">Menipis</Badge> : <Badge color="green">Aman</Badge>}
                                    </td>
                                    <td className="p-3 text-center">
                                        <button className="text-slate-400 hover:text-blue-600 transition-colors p-1.5 rounded-lg hover:bg-blue-50">
                                            <MoreVertical size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                );
            })()}
        </div>
    </div>
    );
};
