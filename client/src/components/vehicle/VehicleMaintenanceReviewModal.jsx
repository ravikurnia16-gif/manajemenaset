import React, { useState } from 'react';
import { X, ShieldCheck, Check, AlertCircle, Car, Wrench, Calendar, Gauge, DollarSign, User, ExternalLink, XCircle } from 'lucide-react';
import api from '../../lib/axios';

export default function VehicleMaintenanceReviewModal({ show, onClose, onSuccess, request, currentUser }) {
    const [approvalNote, setApprovalNote] = useState('');
    const [targetDate, setTargetDate] = useState('');
    const [approvedWorkshop, setApprovedWorkshop] = useState(request?.workshop || '');
    const [showRejectForm, setShowRejectForm] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    if (!show || !request) return null;

    const activeUser = currentUser || (typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {});
    const userPosition = (activeUser?.position || '').toLowerCase();
    const userRole = activeUser?.role || '';
    const isKabidSarana = userPosition.includes('kepala bidang sarana') || userRole === 'SUPER_ADMIN';

    const handleApprove = async () => {
        if (!isKabidSarana) {
            setError('Hak akses ditolak: Hanya pengguna dengan jabatan Kepala Bidang Sarana yang berwenang menyetujui pengajuan.');
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const res = await api.put(`/vehicles/maintenance/${request.id}/approve`, {
                approvalNote,
                targetDate: targetDate || null,
                approvedWorkshop: approvedWorkshop || request.workshop,
            });

            if (onSuccess) onSuccess(res.data?.service);
            onClose();
        } catch (err) {
            console.error('Approve error:', err);
            setError(err.response?.data?.error || 'Gagal menyetujui pengajuan.');
        } finally {
            setLoading(false);
        }
    };

    const handleReject = async () => {
        if (!isKabidSarana) {
            setError('Hak akses ditolak: Hanya pengguna dengan jabatan Kepala Bidang Sarana yang berwenang menolak pengajuan.');
            return;
        }
        if (!rejectionReason.trim()) {
            setError('Alasan penolakan wajib diisi.');
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const res = await api.put(`/vehicles/maintenance/${request.id}/reject`, {
                rejectionReason
            });

            if (onSuccess) onSuccess(res.data?.service);
            onClose();
        } catch (err) {
            console.error('Reject error:', err);
            setError(err.response?.data?.error || 'Gagal menolak pengajuan.');
        } finally {
            setLoading(false);
        }
    };

    const items = Array.isArray(request.items) ? request.items : [];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto">
                {/* Header */}
                <div className="p-4 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-emerald-600/30 border border-emerald-500/40 rounded-xl text-emerald-400">
                            <ShieldCheck size={18} />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm">Verifikasi &amp; Persetujuan SPK Pemeliharaan Kendaraan</h3>
                            <p className="text-[11px] text-slate-400">Otorisasi Resmi Kepala Bidang Sarana Yayasan Dar El-Iman</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 overflow-y-auto space-y-4 text-slate-800 flex-1">
                    {error && (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                            <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Ringkasan Pengajuan */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                        <div className="flex justify-between items-start flex-wrap gap-2">
                            <div>
                                <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                    {request.code || `REQ-${request.id}`}
                                </span>
                                <h4 className="text-sm font-black text-slate-900 mt-1">
                                    {request.vehicle?.name} ({request.vehicle?.plateNumber})
                                </h4>
                                <p className="text-xs text-slate-500">
                                    {request.vehicle?.brand} — {request.vehicle?.type || 'Kendaraan'}
                                </p>
                            </div>

                            <div className="text-right">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                                    request.urgency === 'EMERGENCY' ? 'bg-rose-100 text-rose-700' :
                                    request.urgency === 'URGENT' ? 'bg-amber-100 text-amber-700' :
                                    'bg-slate-200 text-slate-700'
                                }`}>
                                    Urgensi: {request.urgency || 'Normal'}
                                </span>
                                <p className="text-[11px] text-slate-500 mt-1">
                                    {new Date(request.date || request.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </p>
                            </div>
                        </div>

                        {/* Grid Data Teknis */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200 text-xs">
                            <div>
                                <span className="text-[10px] text-slate-400 font-bold block">Pengaju</span>
                                <span className="font-semibold text-slate-800">{request.requester?.name || request.requester?.username || '-'}</span>
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-400 font-bold block">KM Odometer</span>
                                <span className="font-semibold text-slate-800">{request.odometer ? `${request.odometer.toLocaleString()} km` : '-'}</span>
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-400 font-bold block">Estimasi Biaya</span>
                                <span className="font-semibold text-emerald-700 font-mono">{request.estimatedCost ? `Rp ${parseFloat(request.estimatedCost).toLocaleString('id-ID')}` : '-'}</span>
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-400 font-bold block">Usulan Bengkel</span>
                                <span className="font-semibold text-slate-800 truncate block">{request.workshop || '-'}</span>
                            </div>
                        </div>

                        {/* Keluhan */}
                        <div className="pt-2 border-t border-slate-200">
                            <span className="text-[10px] text-slate-400 font-bold block mb-0.5">Keluhan / Indikasi Kerusakan:</span>
                            <p className="text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200 leading-relaxed font-serif">
                                {request.description}
                            </p>
                        </div>

                        {/* Komponen yang diajukan */}
                        {items.length > 0 && (
                            <div className="pt-2 border-t border-slate-200">
                                <span className="text-[10px] text-slate-400 font-bold block mb-1">Komponen yang Diusulkan:</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {items.map((item, idx) => (
                                        <span key={idx} className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-white text-slate-700 border border-slate-200">
                                            • {item.name || item}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Foto Kondisi/Kerusakan */}
                        {request.complaintPhoto && (
                            <div className="pt-2 border-t border-slate-200 flex items-center gap-3">
                                <img
                                    src={request.complaintPhoto}
                                    alt="Foto Kerusakan"
                                    className="w-14 h-14 object-cover rounded-lg border border-slate-300"
                                />
                                <div>
                                    <span className="text-[10px] text-slate-400 font-bold block">Foto Lampiran Kendala:</span>
                                    <a
                                        href={request.complaintPhoto}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1 mt-0.5"
                                    >
                                        <span>Buka Foto Asli</span>
                                        <ExternalLink size={12} />
                                    </a>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Form Keputusan Kabid Sarana */}
                    {!showRejectForm ? (
                        <div className="space-y-3 p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl">
                            <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                                <span>✦</span> Instruksi &amp; Persetujuan Kepala Bidang Sarana
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                        Bengkel yang Ditunjuk:
                                    </label>
                                    <input
                                        type="text"
                                        value={approvedWorkshop}
                                        onChange={(e) => setApprovedWorkshop(e.target.value)}
                                        placeholder="Nama Bengkel Rekanan..."
                                        className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                        Target Tanggal Selesai:
                                    </label>
                                    <input
                                        type="date"
                                        value={targetDate}
                                        onChange={(e) => setTargetDate(e.target.value)}
                                        className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                    Catatan / Arahan Servis untuk Pelaksana &amp; Bengkel:
                                </label>
                                <textarea
                                    value={approvalNote}
                                    onChange={(e) => setApprovalNote(e.target.value)}
                                    rows={2}
                                    placeholder="Contoh: Disetujui ganti oli & filter oli. Pagu maksimal Rp 450.000, minta nota resmi stempel bengkel."
                                    className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-serif leading-relaxed"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3 p-4 bg-rose-50 border border-rose-200 rounded-xl">
                            <div className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                                <XCircle size={15} /> Form Penolakan Pengajuan
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                    Alasan Penolakan <span className="text-rose-600">*</span>:
                                </label>
                                <textarea
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    rows={3}
                                    placeholder="Jelaskan alasan penolakan (misal: KM belum mencukupi jadwal servis, anggaran belum tersedia, dll)..."
                                    className="w-full text-xs p-2.5 bg-white border border-rose-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 leading-relaxed font-serif"
                                    required
                                />
                            </div>
                        </div>
                    )}

                    {/* Footer Actions */}
                    <div className="pt-3 border-t border-slate-200 flex justify-between items-center gap-2">
                        <div>
                            {!showRejectForm ? (
                                <button
                                    type="button"
                                    onClick={() => setShowRejectForm(true)}
                                    disabled={loading || !isKabidSarana}
                                    className="px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    Tolak Pengajuan...
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setShowRejectForm(false)}
                                    className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                                >
                                    Batal Tolak
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                            >
                                Tutup
                            </button>

                            {showRejectForm ? (
                                <button
                                    type="button"
                                    onClick={handleReject}
                                    disabled={loading || !isKabidSarana}
                                    className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
                                >
                                    {loading ? 'Menolak...' : 'Konfirmasi Tolak Pengajuan'}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleApprove}
                                    disabled={loading || !isKabidSarana}
                                    className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer ${
                                        isKabidSarana
                                            ? 'bg-emerald-600 hover:bg-emerald-700'
                                            : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                    }`}
                                    title={isKabidSarana ? 'Setujui dan terbitkan SPK resmi bertanda tangan TTE' : 'Hanya Kepala Bidang Sarana'}
                                >
                                    <ShieldCheck size={14} />
                                    {loading ? 'Menyetujui & Menerbitkan SPK...' : '✦ Setujui & Terbitkan SPK (TTE Kabid Sarana) ✦'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
