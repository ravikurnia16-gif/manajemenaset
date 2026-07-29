import { Search, Plus, Shirt, FileSpreadsheet } from 'lucide-react';
import { Badge } from './UIComponents';

export const ItemsTab = ({ items, loading, search, setSearch, openModal }) => (
    <div className="space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input type="text" placeholder="Cari nama atau kode barang..." className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-100" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button onClick={() => openModal('import-item')} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors">
                <FileSpreadsheet size={14} /> Import Data
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
                        <th className="p-3 text-center">Jenis</th>
                        <th className="p-3 text-center">Gender</th>
                        <th className="p-3 text-center">Unit</th>
                        <th className="p-3 text-center">Ukuran Tersedia</th>
                        <th className="p-3 text-right">Harga Modal</th>
                        <th className="p-3 text-center">Aksi</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {loading ? (
                        <tr><td colSpan="8" className="p-8 text-center text-slate-400">Memuat data barang...</td></tr>
                    ) : items.length === 0 ? (
                        <tr><td colSpan="8" className="p-8 text-center text-slate-400">Belum ada data barang. Klik "Tambah Barang" untuk memulai.</td></tr>
                    ) : items.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                            <td className="p-3 font-mono text-xs text-slate-400">{item.code}</td>
                            <td className="p-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 shrink-0"><Shirt size={18} /></div>
                                    <div>
                                        <div className="font-bold text-slate-800">{item.name}</div>
                                        <div className="text-[10px] text-slate-400">{item.vendor?.name || '-'}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="p-3 text-center"><Badge color="indigo">{item.category?.name}</Badge></td>
                            <td className="p-3 text-center"><Badge color="purple">{item.clothingType?.name || '-'}</Badge></td>
                            <td className="p-3 text-center"><Badge color={item.gender === 'IKHWAN' ? 'blue' : item.gender === 'AKHWAT' ? 'pink' : 'slate'}>{item.gender === 'IKHWAN' ? 'Ikhwan' : item.gender === 'AKHWAT' ? 'Akhwat' : '-'}</Badge></td>
                            <td className="p-3 text-center"><Badge>{item.unit?.name || item.targetUnit || '-'}</Badge></td>
                            <td className="p-3 text-center">
                                <div className="flex flex-wrap gap-1 justify-center">
                                    {item.variants?.map(v => {
                                        const totalStock = v.stocks?.reduce((s, st) => s + st.quantity, 0) || 0;
                                        return <span key={v.id} className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${totalStock <= 0 ? 'bg-red-50 text-red-500 border-red-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{v.sizeName} ({totalStock})</span>;
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
