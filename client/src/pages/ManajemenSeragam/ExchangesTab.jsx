import { RefreshCw } from 'lucide-react';
import { Badge } from './UIComponents';

export const ExchangesTab = ({ exchanges, openModal }) => (
    <div className="space-y-4">
        <div className="flex justify-end">
            <button onClick={() => openModal('exchange')} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-blue-500/20">
                <RefreshCw size={14} /> Tukar Ukuran
            </button>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                    <tr>
                        <th className="p-3 text-left">Kode</th>
                        <th className="p-3 text-left">Pelanggan</th>
                        <th className="p-3 text-left">Dari</th>
                        <th className="p-3 text-center">→</th>
                        <th className="p-3 text-left">Ke</th>
                        <th className="p-3 text-center">Qty</th>
                        <th className="p-3 text-center">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {exchanges.length === 0 ? (
                        <tr><td colSpan="7" className="p-8 text-center text-slate-400">Belum ada data tukar ukuran.</td></tr>
                    ) : exchanges.map(e => (
                        <tr key={e.id} className="hover:bg-slate-50/80">
                            <td className="p-3 font-mono text-xs text-slate-400">{e.code}</td>
                            <td className="p-3 font-bold text-slate-800">{e.customerName}</td>
                            <td className="p-3 text-sm">{e.fromVariant?.item?.name} <Badge>{e.fromVariant?.size}</Badge></td>
                            <td className="p-3 text-center text-slate-400">→</td>
                            <td className="p-3 text-sm">{e.toVariant?.item?.name} <Badge color="blue">{e.toVariant?.size}</Badge></td>
                            <td className="p-3 text-center font-bold">{e.qty}</td>
                            <td className="p-3 text-center"><Badge color={e.status === 'COMPLETED' ? 'green' : e.status === 'REJECTED' ? 'red' : 'orange'}>{e.status}</Badge></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);
