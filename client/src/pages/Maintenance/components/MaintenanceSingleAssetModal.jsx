import React from 'react';
import { X, CheckCircle2, Loader2 } from 'lucide-react';

export default function MaintenanceSingleAssetModal({
    modalState,
    onClose,
    onSave,
    onChangeAction,
    onChangeCondition
}) {
    if (!modalState.show || !modalState.asset) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <div>
                        <h3 className="text-sm font-bold text-slate-800">Catat Tindakan Aset</h3>
                        <p className="text-xs text-blue-600 font-mono font-bold mt-0.5">
                            {modalState.asset.code} <span className="text-slate-600 font-sans font-medium">— {modalState.asset.name}</span>
                        </p>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="text-slate-400 hover:text-slate-600"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                            Tindakan Perbaikan pada Aset Ini *
                        </label>
                        <textarea
                            value={modalState.actionTaken}
                            onChange={e => onChangeAction(e.target.value)}
                            placeholder="Contoh: Penggantian kapasitor, perbaikan pipa outdoor, cuci filter..."
                            rows={3}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs resize-none focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                            Kondisi Fisik Akhir Aset *
                        </label>
                        <select
                            value={modalState.condition}
                            onChange={e => onChangeCondition(e.target.value)}
                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="BAIK">BAIK (Telah selesai & berfungsi normal)</option>
                            <option value="RUSAK_RINGAN">RUSAK RINGAN (Masih dapat digunakan sementara)</option>
                            <option value="RUSAK_BERAT">RUSAK BERAT (Mati total / rekomendasi penggantian)</option>
                        </select>
                    </div>
                </div>

                <div className="flex gap-2 pt-3 border-t border-slate-100">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        onClick={onSave}
                        disabled={modalState.saving || !modalState.actionTaken.trim()}
                        className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center justify-center gap-1.5"
                    >
                        {modalState.saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        <span>Simpan & Tandai Selesai</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
