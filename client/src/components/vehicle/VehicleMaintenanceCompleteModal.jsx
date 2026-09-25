import React, { useState } from 'react';
import { X, CheckCircle2, DollarSign, Upload, AlertCircle, Wrench, Gauge, Building } from 'lucide-react';
import api from '../../lib/axios';

export default function VehicleMaintenanceCompleteModal({ show, onClose, onSuccess, request }) {
    const [cost, setCost] = useState(request?.estimatedCost || '');
    const [workshop, setWorkshop] = useState(request?.workshop || '');
    const [odometer, setOdometer] = useState(request?.odometer || request?.vehicle?.odometer || '');
    const [proofFile, setProofFile] = useState(null);
    const [proofPreview, setProofPreview] = useState(null);
    const [items, setItems] = useState(() => {
        if (Array.isArray(request?.items)) {
            return request.items.map(it => ({
                name: it.name || it,
                cost: it.cost || '',
                isRoutine: it.isRoutine !== undefined ? it.isRoutine : true
            }));
        }
        return [];
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    if (!show || !request) return null;

    const handleProofChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setProofFile(file);
            setProofPreview(URL.createObjectURL(file));
        }
    };

    const handleItemCostChange = (index, val) => {
        setItems(prev => {
            const next = [...prev];
            next[index] = { ...next[index], cost: val };
            return next;
        });
    };

    const handleComplete = async (e) => {
        e.preventDefault();
        if (!cost || parseFloat(cost) <= 0) {
            setError('Biaya aktual servis wajib diisi.');
            return;
        }
        if (!proofFile && !request.proofFile) {
            setError('Foto bukti nota / faktur bengkel wajib diunggah.');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const formData = new FormData();
            formData.append('cost', cost);
            if (workshop) formData.append('workshop', workshop);
            if (odometer) formData.append('odometer', odometer);
            formData.append('items', JSON.stringify(items));
            if (proofFile) {
                formData.append('proofFile', proofFile);
            }

            const res = await api.put(`/vehicles/maintenance/${request.id}/complete`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (onSuccess) onSuccess(res.data?.service);
            onClose();
        } catch (err) {
            console.error('Complete service error:', err);
            setError(err.response?.data?.error || 'Gagal menyelesaikan servis kendaraan.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto">
                {/* Header */}
                <div className="p-4 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-emerald-600/30 border border-emerald-500/40 rounded-xl text-emerald-400">
                            <CheckCircle2 size={18} />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm">Penyelesaian Servis &amp; Input Nota Bengkel</h3>
                            <p className="text-[11px] text-slate-400">Armada: {request.vehicle?.name} ({request.vehicle?.plateNumber})</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleComplete} className="p-5 overflow-y-auto space-y-4 text-slate-800 flex-1">
                    {error && (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                            <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Biaya Riil & Bengkel */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                Biaya Aktual Sesuai Nota (Rp) <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                                <DollarSign size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="number"
                                    value={cost}
                                    onChange={(e) => setCost(e.target.value)}
                                    placeholder="Contoh: 450000"
                                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                Nama Bengkel Pelaksana <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                                <Building size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={workshop}
                                    onChange={(e) => setWorkshop(e.target.value)}
                                    placeholder="Contoh: Bengkel Sentosa Padang"
                                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    {/* Odometer Saat Servis */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                            KM Odometer Saat Servis Selesai:
                        </label>
                        <div className="relative">
                            <Gauge size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="number"
                                value={odometer}
                                onChange={(e) => setOdometer(e.target.value)}
                                placeholder="Contoh: 46100"
                                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">KM ini akan otomatis memperbarui jarak tempuh terakhir dan pengingat servis berikutnya.</p>
                    </div>

                    {/* Upload Foto Nota */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                            Foto Bukti Nota / Faktur Bengkel <span className="text-rose-500">*</span>
                        </label>
                        <div className="flex items-center gap-3">
                            <label className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors">
                                <Upload size={14} />
                                <span>{proofFile ? 'Ganti Foto Nota' : 'Unggah Foto Nota'}</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleProofChange}
                                    className="hidden"
                                />
                            </label>
                            {proofPreview && (
                                <div className="relative group">
                                    <img
                                        src={proofPreview}
                                        alt="Nota Preview"
                                        className="w-14 h-14 object-cover rounded-lg border border-slate-200"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => { setProofFile(null); setProofPreview(null); }}
                                        className="absolute -top-1 -right-1 bg-rose-500 text-white rounded-full p-0.5"
                                    >
                                        <X size={10} />
                                    </button>
                                </div>
                            )}
                            <span className="text-[11px] text-slate-400 italic">Format: JPG, PNG, WEBP</span>
                        </div>
                    </div>

                    {/* Rincian Komponen Selesai */}
                    {items.length > 0 && (
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                Rincian Komponen &amp; Biaya (Opsional per item):
                            </label>
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 max-h-40 overflow-y-auto">
                                {items.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between gap-2 text-xs">
                                        <span className="font-semibold text-slate-700 flex-1 truncate">• {item.name}</span>
                                        <div className="w-32">
                                            <input
                                                type="number"
                                                value={item.cost || ''}
                                                onChange={(e) => handleItemCostChange(idx, e.target.value)}
                                                placeholder="Biaya Rp"
                                                className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded-lg text-right font-mono"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="pt-3 border-t border-slate-200 flex justify-end items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                            <CheckCircle2 size={14} />
                            {loading ? 'Menyimpan...' : 'Selesaikan & Catat Log Resmi'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
