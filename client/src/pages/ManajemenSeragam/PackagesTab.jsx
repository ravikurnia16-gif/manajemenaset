import { Plus } from 'lucide-react';
import { Badge } from './UIComponents';

export const PackagesTab = ({ packages, openModal }) => (
    <div className="space-y-4">
        <div className="flex justify-end">
            <button onClick={() => openModal('package')} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-blue-500/20">
                <Plus size={14} /> Buat Paket
            </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {packages.length === 0 ? (
                <div className="col-span-full bg-white rounded-2xl border border-slate-100 p-8 text-center text-slate-400">Belum ada paket SPMB.</div>
            ) : packages.map(pkg => (
                <div key={pkg.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                        <div>
                            <h3 className="font-bold text-slate-800">{pkg.name}</h3>
                            <div className="flex gap-1.5 mt-1">
                                {pkg.targetUnit && <Badge color="blue">{pkg.targetUnit}</Badge>}
                                {pkg.gender && <Badge>{pkg.gender === 'L' ? 'Putra' : pkg.gender === 'P' ? 'Putri' : 'Unisex'}</Badge>}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-lg font-extrabold text-blue-600">Rp {(pkg.price || 0).toLocaleString('id-ID')}</div>
                            <div className="text-[10px] text-slate-400">{pkg.isFixedPrice ? 'Harga Fixed' : 'Harga Dinamis'}</div>
                        </div>
                    </div>
                    <div className="border-t border-slate-100 pt-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Isi Paket ({pkg.items?.length || 0} item)</p>
                        {pkg.items?.map(pi => (
                            <div key={pi.id} className="flex justify-between text-xs text-slate-600 py-0.5">
                                <span>
                                    {pi.item?.category?.name || ''}_{pi.item?.clothingType?.name || ''}_{pi.item?.unit?.name || ''}
                                </span>
                                <span className="text-slate-400">x{pi.qty}</span>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    </div>
);
