import { Search } from 'lucide-react';
import { Badge } from './UIComponents';

export const ItemsTab = ({ variants = [], loading, search, setSearch }) => {
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input type="text" placeholder="Cari SKU atau nama barang..." className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-100" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                        <tr>
                            <th className="p-3 text-left">SKU</th>
                            <th className="p-3 text-left">Nama Barang</th>
                            <th className="p-3 text-center">Gender</th>
                            <th className="p-3 text-center">Ukuran</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan="4" className="p-8 text-center text-slate-400">Memuat data...</td></tr>
                        ) : variants.length === 0 ? (
                            <tr><td colSpan="4" className="p-8 text-center text-slate-400">Belum ada data barang.</td></tr>
                        ) : variants.map(v => (
                            <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="p-3 font-mono text-xs text-slate-400">{v.sku}</td>
                                <td className="p-3 font-bold text-slate-800">{v.item?.name}</td>
                                <td className="p-3 text-center"><Badge>{v.item?.gender}</Badge></td>
                                <td className="p-3 text-center"><Badge color="blue">{v.sizeName}</Badge></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
