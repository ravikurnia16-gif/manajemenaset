import { Plus, MapPin, Mail, Pencil, ExternalLink, RefreshCw } from 'lucide-react';
import api from '../../lib/axios';

export const VendorsTab = ({ vendors, openModal, onRefresh }) => {
    const handleSync = async () => {
        try {
            await api.get('/uniforms/vendors/sync-ratings');
            if (onRefresh) onRefresh();
            alert('Sinkronisasi rating berhasil!');
        } catch (e) {
            alert('Gagal menyinkronkan: ' + e.message);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-800">Profil Vendor</h2>
                <div className="flex gap-2">
                    <button onClick={handleSync} className="bg-slate-100 text-slate-700 hover:bg-slate-200 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors">
                        <RefreshCw size={14} /> Sync Rating
                    </button>
                    <button onClick={() => openModal('vendor')} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-blue-500/20">
                        <Plus size={14} /> Tambah Vendor
                    </button>
                </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {vendors.length === 0 ? (
                    <div className="col-span-full bg-white rounded-2xl border border-slate-100 p-8 text-center text-slate-400">Belum ada data vendor.</div>
                ) : vendors.map(v => (
                    <div key={v.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow relative">
                        <div className="absolute top-4 right-4">
                            <button onClick={() => openModal('vendor', v)} className="text-slate-400 hover:text-blue-600 p-1 rounded-lg hover:bg-blue-50 transition-colors">
                                <Pencil size={16} />
                            </button>
                        </div>
                        <h3 className="font-bold text-slate-800 mb-1 pr-8">{v.name}</h3>
                        <p className="text-xs text-slate-500 mb-2">{v.phone || '-'} • {v.contactPerson || '-'}</p>
                        
                        <div className="space-y-1 mb-4 text-xs text-slate-600">
                            {(v.address || v.mapsUrl) && (
                                <div className="flex items-start gap-1.5">
                                    <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="block">{v.address || 'Alamat tidak tersedia'}</span>
                                        {v.mapsUrl && (
                                            <a href={v.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 mt-0.5">
                                                Lihat di Maps <ExternalLink size={10} />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )}
                            {v.email && (
                                <div className="flex items-center gap-1.5">
                                    <Mail size={14} className="text-slate-400 shrink-0" />
                                    <span>{v.email}</span>
                                </div>
                            )}
                        </div>

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
};
