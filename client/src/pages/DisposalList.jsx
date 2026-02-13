import { useState, useEffect } from 'react';
import { Trash2, Search, Calendar, User, Info, AlertCircle } from 'lucide-react';
import api from '../lib/axios';

const DisposalList = () => {
    const [disposals, setDisposals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchDisposals();
    }, []);

    const fetchDisposals = async () => {
        try {
            setLoading(true);
            const res = await api.get('/disposals');
            setDisposals(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const filteredDisposals = Array.isArray(disposals) ? disposals.filter(d =>
        d.asset?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.asset?.code?.toLowerCase().includes(searchTerm.toLowerCase())
    ) : [];

    if (loading) return <div className="p-8 text-center text-slate-500 font-medium">Memuat riwayat penghapusan...</div>;

    return (
        <div className="p-4 md:p-6 space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Trash2 className="text-red-600" /> Riwayat Penghapusan Aset
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Daftar seluruh aset yang telah dihapus atau dikeluarkan dari inventaris aktif
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-slate-50 flex items-center gap-3">
                    <Search className="text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Cari aset yang dihapus..."
                        className="flex-1 bg-transparent border-none outline-none text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-bold tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Aset</th>
                                <th className="px-6 py-4">Tanggal Hapus</th>
                                <th className="px-6 py-4">Metode & Alasan</th>
                                <th className="px-6 py-4">Otorisasi</th>
                                <th className="px-6 py-4 font-mono">Kode Aset</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredDisposals.length > 0 ? filteredDisposals.map(d => (
                                <tr key={d.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-semibold text-slate-800">{d.asset?.name}</div>
                                        <div className="text-[10px] text-slate-400 uppercase">{d.asset?.category?.name}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2 text-slate-600">
                                            <Calendar size={14} className="text-slate-400" />
                                            {new Date(d.disposalDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded text-[10px] font-bold uppercase tracking-tight">
                                                {d.method || 'LAINNYA'}
                                            </span>
                                        </div>
                                        <div className="text-xs text-slate-600 leading-relaxed font-medium">
                                            {d.reason}
                                        </div>
                                        {d.notes && (
                                            <div className="text-[10px] text-slate-400 mt-1 italic flex items-start gap-1">
                                                <Info size={10} className="mt-0.5 shrink-0" /> {d.notes}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-[10px]">
                                                {d.authorizedBy?.name?.charAt(0) || 'A'}
                                            </div>
                                            <div className="text-xs font-medium text-slate-700">{d.authorizedBy?.name || d.authorizedBy?.username}</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-xs text-slate-400">
                                        {d.asset?.code}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center gap-2 opacity-60">
                                            <AlertCircle size={32} />
                                            <p className="font-medium">Tidak ada data penghapusan ditemukan</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default DisposalList;
