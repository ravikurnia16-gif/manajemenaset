import React from 'react';
import { X, Loader2 } from 'lucide-react';

export default function MaintenanceAssetHistoryModal({
    historyModal,
    onClose
}) {
    if (!historyModal.show) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-2xl max-h-[80vh] flex flex-col animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <div>
                        <h3 className="text-base font-bold text-slate-800">Riwayat Perbaikan Aset</h3>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">
                            {historyModal.asset?.code} - <span className="font-sans font-semibold">{historyModal.asset?.name}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="overflow-y-auto flex-1 pr-1 space-y-3">
                    {historyModal.loading ? (
                        <div className="flex justify-center items-center py-10 text-slate-400">
                            <Loader2 size={24} className="animate-spin text-blue-600" />
                        </div>
                    ) : historyModal.timeline.length > 0 ? (
                        historyModal.timeline.map((item, idx) => (
                            <div key={idx} className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-xs space-y-1.5">
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-slate-800">{item.description}</span>
                                    <span className="text-[10px] text-slate-400 font-mono">
                                        {new Date(item.date).toLocaleDateString('id-ID')}
                                    </span>
                                </div>
                                {item.note && <p className="text-slate-600 text-[11px]">{item.note}</p>}
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-8 text-xs text-slate-400 italic">
                            Belum ada riwayat perbaikan sebelumnya untuk aset ini.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
