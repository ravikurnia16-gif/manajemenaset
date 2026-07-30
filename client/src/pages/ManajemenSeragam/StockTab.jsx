import { Search, Plus, Download, Upload, ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from './UIComponents';
import { useRef, useState, useMemo } from 'react';
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
                const groupedStocks = Object.values(stocks.reduce((acc, s) => {
                    const vid = s.variant?.id;
                    if (!vid) return acc;
                    if (!acc[vid]) {
                        acc[vid] = {
                            id: vid,
                            variant: s.variant,
                            quantity: 0,
                            minStock: s.variant?.item?.minStock || s.minStock || 3,
                            details: []
                        };
                    }
                    acc[vid].quantity += s.quantity;
                    acc[vid].details.push(s);
                    return acc;
                }, {}));

                return (
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                            <tr>
                                <th className="p-3 w-8"></th>
                                <th className="p-3 text-left">SKU</th>
                                <th className="p-3 text-left">Barang</th>
                                <th className="p-3 text-center">Ukuran</th>
                                <th className="p-3 text-center">Total Stok</th>
                                <th className="p-3 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan="6" className="p-8 text-center text-slate-400">Memuat data...</td></tr>
                            ) : groupedStocks.length === 0 ? (
                                <tr><td colSpan="6" className="p-8 text-center text-slate-400">Belum ada data stok.</td></tr>
                            ) : groupedStocks.map(g => (
                                <React.Fragment key={g.id}>
                                    <tr 
                                        className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                                        onClick={() => setExpandedRow(expandedRow === g.id ? null : g.id)}
                                    >
                                        <td className="p-3 text-slate-400 text-center">
                                            {expandedRow === g.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                        </td>
                                        <td className="p-3 font-mono text-xs text-slate-400">{g.variant?.sku}</td>
                                        <td className="p-3 font-bold text-slate-800">{g.variant?.item?.name}</td>
                                        <td className="p-3 text-center"><Badge>{g.variant?.sizeName}</Badge></td>
                                        <td className="p-3 text-center">
                                            <span className={`font-extrabold text-lg ${g.quantity <= g.minStock ? 'text-red-500' : 'text-slate-700'}`}>
                                                {g.quantity}
                                            </span>
                                            <span className="text-xs text-slate-400 ml-1">/ {g.minStock}</span>
                                        </td>
                                        <td className="p-3 text-center">
                                            {g.quantity <= 0 ? <Badge color="red">Habis</Badge> : g.quantity <= g.minStock ? <Badge color="orange">Menipis</Badge> : <Badge color="green">Aman</Badge>}
                                        </td>
                                    </tr>
                                    {expandedRow === g.id && (
                                        <tr>
                                            <td colSpan="6" className="p-0 bg-slate-50 border-b border-slate-100">
                                                <div className="p-4 pl-12 overflow-x-auto">
                                                    <table className="w-full text-xs text-left text-slate-600">
                                                        <thead className="bg-slate-100 text-slate-500">
                                                            <tr>
                                                                <th className="px-3 py-2 rounded-tl-lg rounded-bl-lg">Gudang</th>
                                                                <th className="px-3 py-2">Vendor</th>
                                                                <th className="px-3 py-2 text-right">Modal Awal</th>
                                                                <th className="px-3 py-2 text-center rounded-tr-lg rounded-br-lg">Stok</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {g.details.map((detail, idx) => (
                                                                <tr key={idx} className="hover:bg-white transition-colors">
                                                                    <td className="px-3 py-2 font-medium text-slate-700">{detail.warehouse?.name}</td>
                                                                    <td className="px-3 py-2">{detail.vendor?.name || '-'}</td>
                                                                    <td className="px-3 py-2 text-right">Rp {(detail.modalAwal || 0).toLocaleString('id-ID')}</td>
                                                                    <td className="px-3 py-2 text-center font-bold">{detail.quantity}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                );
            })()}
        </div>
    </div>
    );
};
