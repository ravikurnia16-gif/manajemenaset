import { Plus } from 'lucide-react';

export const VendorsTab = ({ vendors, openModal }) => (
    <div className="space-y-4">
        <div className="flex justify-end">
            <button onClick={() => openModal('vendor')} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-blue-500/20">
                <Plus size={14} /> Tambah Vendor
            </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {vendors.length === 0 ? (
                <div className="col-span-full bg-white rounded-2xl border border-slate-100 p-8 text-center text-slate-400">Belum ada data vendor.</div>
            ) : vendors.map(v => (
                <div key={v.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                    <h3 className="font-bold text-slate-800 mb-1">{v.name}</h3>
                    <p className="text-xs text-slate-500 mb-3">{v.phone || '-'} • {v.contactPerson || '-'}</p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-slate-50 rounded-lg p-2">
                            <div className="text-lg font-extrabold text-slate-700">{v.rating?.toFixed(1) || '0.0'}</div>
                            <div className="text-[10px] text-slate-400">Rating</div>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-2">
                            <div className="text-lg font-extrabold text-green-600">{v.onTimeRate?.toFixed(0) || 0}%</div>
                            <div className="text-[10px] text-slate-400">Tepat Waktu</div>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-2">
                            <div className="text-lg font-extrabold text-red-500">{v.rejectRate?.toFixed(0) || 0}%</div>
                            <div className="text-[10px] text-slate-400">Reject</div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    </div>
);
